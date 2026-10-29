import json
import os
import tempfile
import unittest
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

TMP = tempfile.mkdtemp()
os.environ["AIGUARD_DATA_DIR"] = TMP

from aiguard_agent.catalog import ToolMatcher  # noqa: E402
from aiguard_agent.config import AgentConfig  # noqa: E402
from aiguard_agent.dlp import scan  # noqa: E402
from aiguard_agent.enforcement import BEGIN, END, render_hosts  # noqa: E402
from aiguard_agent.local_api import origin_allowed, serve  # noqa: E402
from aiguard_agent.policy import decide, within_schedule  # noqa: E402
from aiguard_agent.service import Agent  # noqa: E402
from aiguard_agent.sessions import SessionTracker  # noqa: E402
from aiguard_agent.store import Store  # noqa: E402

TOOLS = [
    {"key": "chatgpt", "name": "ChatGPT", "domains": ["chatgpt.com", "chat.openai.com"],
     "processes": {"windows": ["ChatGPT.exe"], "macos": ["ChatGPT"]}},
    {"key": "openai_api", "name": "OpenAI API", "domains": ["api.openai.com"], "processes": {}},
    {"key": "deepseek", "name": "DeepSeek", "domains": ["chat.deepseek.com"], "processes": {}},
]
MONDAY_10AM = datetime(2026, 10, 26, 10, 0)
SUNDAY_10AM = datetime(2026, 11, 1, 10, 0)


class PolicyTests(unittest.TestCase):
    def test_default_allow(self):
        self.assertEqual(decide({}, "chatgpt", MONDAY_10AM, {}).action, "allow")

    def test_tool_rule_and_default_action(self):
        policy = {"default_action": "warn", "tool_rules": [{"tool": "deepseek", "action": "block"}],
                  "block_message": "nope"}
        d = decide(policy, "deepseek", MONDAY_10AM, {})
        self.assertEqual((d.action, d.message), ("block", "nope"))
        self.assertEqual(decide(policy, "chatgpt", MONDAY_10AM, {}).action, "warn")

    def test_schedule(self):
        sched = {"days": [0, 1, 2, 3, 4], "start": "08:00", "end": "18:00", "outside_action": "block"}
        self.assertTrue(within_schedule(sched, MONDAY_10AM))
        self.assertFalse(within_schedule(sched, SUNDAY_10AM))
        self.assertFalse(within_schedule(sched, MONDAY_10AM.replace(hour=18)))
        overnight = {"days": [0], "start": "22:00", "end": "06:00"}
        self.assertTrue(within_schedule(overnight, MONDAY_10AM.replace(hour=23)))
        d = decide({"schedule": sched}, "chatgpt", SUNDAY_10AM, {})
        self.assertEqual((d.action, d.reason), ("block", "outside allowed hours"))

    def test_quotas(self):
        policy = {"tool_rules": [{"tool": "chatgpt", "action": "allow", "daily_minutes": 30}],
                  "daily_minutes_total": 60}
        self.assertEqual(decide(policy, "chatgpt", MONDAY_10AM, {"chatgpt": 29 * 60}).action, "allow")
        self.assertEqual(decide(policy, "chatgpt", MONDAY_10AM, {"chatgpt": 30 * 60}).action, "block")
        self.assertEqual(decide(policy, "deepseek", MONDAY_10AM, {"chatgpt": 20 * 60, "claude": 40 * 60}).action,
                         "block")

    def test_most_severe_wins(self):
        policy = {"default_action": "warn",
                  "schedule": {"days": [0], "start": "00:00", "end": "23:59", "outside_action": "warn"},
                  "daily_minutes_total": 1}
        d = decide(policy, "chatgpt", MONDAY_10AM, {"chatgpt": 120})
        self.assertEqual(d.action, "block")
        self.assertIn("daily AI limit", d.reason)


class DlpTests(unittest.TestCase):
    def test_detectors(self):
        text = "card 4111 1111 1111 1111 key sk-ant-abcdefghijklmnopqrstuvwxyz IC 900101-14-5678 mail a@b.co"
        self.assertEqual(scan(text, ["credit_card", "api_key", "my_nric", "email"], []),
                         ["credit_card", "api_key", "my_nric", "email"])

    def test_credentials(self):
        for text in ["login ID adam, password: Abc12345", "my pwd=hunter2", "Password is S3cret!",
                     "kata laluan: rahsia123", "postgres://admin:s3cret@db.local/app",
                     "-----BEGIN OPENSSH PRIVATE KEY-----"]:
            self.assertEqual(scan(text, ["credentials"], []), ["credentials"], text)
        for text in ["how do I reset my password?", "password policy best practices", "passport renewal"]:
            self.assertEqual(scan(text, ["credentials"], []), [], text)

    def test_luhn_filters_random_digits(self):
        self.assertEqual(scan("order 1234 5678 9012 3456", ["credit_card"], []), [])

    def test_keywords(self):
        self.assertEqual(scan("Plan for Project Falcon launch", [], ["project falcon", "zeus"]),
                         ["keyword:project falcon"])


class MatcherTests(unittest.TestCase):
    def test_domains_and_processes(self):
        m = ToolMatcher(TOOLS, os_name="windows")
        self.assertEqual(m.match_domain("chatgpt.com"), "chatgpt")
        self.assertEqual(m.match_domain("www.chatgpt.com"), "chatgpt")
        self.assertEqual(m.match_domain("api.openai.com"), "openai_api")
        self.assertIsNone(m.match_domain("notchatgpt.com"))
        self.assertEqual(m.match_process("chatgpt.EXE"), "chatgpt")
        self.assertIsNone(ToolMatcher(TOOLS, os_name="macos").match_process("ChatGPT.exe"))


class HostsTests(unittest.TestCase):
    def test_render_is_idempotent_and_removable(self):
        original = "127.0.0.1 localhost\n"
        blocked = render_hosts(original, ["chat.deepseek.com"])
        self.assertIn("0.0.0.0 chat.deepseek.com", blocked)
        self.assertIn(BEGIN, blocked)
        self.assertEqual(render_hosts(blocked, ["chat.deepseek.com"]), blocked)
        cleared = render_hosts(blocked, [])
        self.assertEqual(cleared, original)
        self.assertNotIn(END, cleared)


class SessionTests(unittest.TestCase):
    def test_idle_and_chunking(self):
        events = []
        tracker = SessionTracker(lambda **e: events.append(e), idle_timeout=120, max_chunk=900)
        tracker.tick("chatgpt", "browser", 15, now=0, domain="chatgpt.com")
        tracker.tick("chatgpt", "browser", 15, now=15)
        self.assertEqual(tracker.flush(now=60), 0)
        tracker.flush(now=200)
        self.assertEqual(events[0]["duration_seconds"], 30)
        self.assertEqual(events[0]["domain"], "chatgpt.com")
        tracker.tick("cursor", "process", 1000, now=300)
        tracker.flush(now=301)
        self.assertEqual(events[1]["duration_seconds"], 1000)


class FakeClient:
    def __init__(self):
        self.sent = []

    def send_events(self, events):
        self.sent.extend(events)
        return {"accepted": len(events)}

    def config(self):
        return {}


class FakeHosts:
    def __init__(self):
        self.domains = None

    def apply(self, domains):
        self.domains = sorted(domains)


class FakeNotifier:
    def notify(self, *args):
        pass


def make_agent(policy):
    store = Store(Path(tempfile.mkdtemp()) / "agent.db")
    store.set_json("config", {"policy": policy, "policy_version": "p:1", "tools": TOOLS})
    agent = Agent(AgentConfig(server_url="https://x", device_token="t"), store, notifier=FakeNotifier(),
                  hosts=FakeHosts(), client=FakeClient())
    return agent


BASE_POLICY = {
    "default_action": "allow", "tool_rules": [{"tool": "deepseek", "action": "block"},
                                              {"tool": "chatgpt", "action": "allow", "daily_minutes": 1}],
    "capture_prompts": False, "dlp": {"enabled": True, "detectors": ["credit_card"], "keywords": [], "action": "block"},
    "enforce_hosts_file": True, "block_message": "blocked by policy",
}


class AgentTests(unittest.TestCase):
    def test_visit_and_quota_and_upload(self):
        agent = make_agent(BASE_POLICY)
        self.assertEqual(agent.handle_visit("deepseek", "chat.deepseek.com")["action"], "block")
        self.assertEqual(agent.handle_activity("chatgpt", 30)["action"], "allow")
        result = agent.handle_activity("chatgpt", 30)
        self.assertEqual(result["action"], "block")
        self.assertIn("daily limit", result["reason"])
        agent.sessions.flush(force=True)
        agent.sync_tick()
        types = sorted((e["tool_key"], e["event_type"]) for e in agent.client.sent)
        self.assertEqual(types, [("chatgpt", "blocked"), ("chatgpt", "session"), ("deepseek", "blocked")])
        self.assertEqual(agent.store.outbox_size(), 0)

    def test_prompt_dlp_and_capture(self):
        agent = make_agent(BASE_POLICY)
        r = agent.handle_prompt("chatgpt", text="my card is 4111111111111111")
        self.assertEqual((r["action"], r["hits"]), ("block", ["credit_card"]))
        agent.handle_prompt("chatgpt", text="hello")
        events = agent.store.pending_events()
        self.assertTrue(all(e["prompt_text"] is None for e in events))
        self.assertEqual([e["event_type"] for e in events], ["dlp", "prompt"])

        capturing = make_agent({**BASE_POLICY, "capture_prompts": True})
        capturing.handle_prompt("chatgpt", text="hello")
        self.assertEqual(capturing.store.pending_events()[0]["prompt_text"], "hello")

    def test_hosts_tick_blocks_only_blocked_tools(self):
        agent = make_agent(BASE_POLICY)
        agent.hosts_tick()
        self.assertEqual(agent.hosts.domains, ["chat.deepseek.com"])
        agent.store.add_usage("chatgpt", 120)
        agent.hosts_tick()
        self.assertEqual(agent.hosts.domains, ["chat.deepseek.com", "chat.openai.com", "chatgpt.com"])


class LocalApiTests(unittest.TestCase):
    def test_origin_rules(self):
        self.assertFalse(origin_allowed(None, ()))
        self.assertFalse(origin_allowed("https://evil.example", ()))
        self.assertTrue(origin_allowed("chrome-extension://abc", ()))
        self.assertFalse(origin_allowed("chrome-extension://abc", ("xyz",)))
        self.assertTrue(origin_allowed("chrome-extension://xyz", ("xyz",)))

    def test_http_roundtrip(self):
        agent = make_agent(BASE_POLICY)
        server = serve(agent, (), port=0)
        port = server.server_address[1]
        try:
            def call(path, body=None, origin="chrome-extension://abc", client=True):
                headers = {"Content-Type": "application/json"}
                if origin:
                    headers["Origin"] = origin
                if client:
                    headers["X-AIGuard-Client"] = "extension"
                req = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
                                             data=json.dumps(body).encode() if body is not None else None,
                                             headers=headers)
                with urllib.request.urlopen(req, timeout=5) as resp:
                    return json.loads(resp.read())

            self.assertEqual(call("/v1/visit", {"tool_key": "deepseek"})["action"], "block")
            policy = call("/v1/policy")
            self.assertTrue(policy["status"]["dlp_enabled"])
            self.assertEqual(policy["decisions"]["deepseek"]["action"], "block")
            self.assertIn("decisions", call("/v1/policy", origin=None))  # Chrome omits Origin on extension GETs
            for kwargs in ({"origin": "https://evil.example"}, {"client": False}):
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    call("/v1/policy", **kwargs)
                self.assertEqual(ctx.exception.code, 403)
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                call("/v1/visit", {"tool_key": "deepseek"}, origin=None)
            self.assertEqual(ctx.exception.code, 403)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
