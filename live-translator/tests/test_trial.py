"""Trial preset: English → Mandarin only, VB-Cable matched by name."""
import json
import tempfile
import time
import unittest
from pathlib import Path

from starlette.testclient import TestClient

from test_core import FakePlayers, fake_engines
from translator.config import ConfigStore
from translator.server import create_app

PRESET = Path(__file__).resolve().parent.parent / "presets" / "trial-en-zh.json"


class TrialPresetTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg_path = Path(self.tmp.name) / "config.json"

    def tearDown(self):
        self.tmp.cleanup()

    def test_preset_seeds_first_run_only(self):
        store = ConfigStore(self.cfg_path, preset=PRESET)
        cfg = store.get()
        self.assertEqual(cfg["engines"], {"asr": "local", "translate": "local", "tts": "edge"})
        ch = cfg["routes"][0]["channels"][0]
        self.assertEqual((cfg["routes"][0]["source_lang"], ch["target_lang"]), ("en", "zh"))
        self.assertEqual(ch["output_names"], ["CABLE Input"])
        store.update({"vad": {"silence_ms": 900}})
        again = ConfigStore(self.cfg_path, preset=PRESET).get()  # user's changes are kept
        self.assertEqual(again["vad"]["silence_ms"], 900)

    def test_only_english_and_mandarin_offered(self):
        store = ConfigStore(self.cfg_path, preset=PRESET)
        app = create_app(store=store, engines_factory=fake_engines, input_factory=None,
                         players=FakePlayers(), output_resolver=lambda n: None)
        with TestClient(app) as c:
            codes = {l["code"] for l in c.get("/api/config").json()["languages"]}
            self.assertEqual(codes, {"en", "zh"})

    def test_cable_found_by_name_and_spoken_to(self):
        store = ConfigStore(self.cfg_path, preset=PRESET)
        cfg = store.get()
        cfg["routes"][0]["input"] = {"type": "browser", "device": None}  # no sound card in CI
        store.update({"routes": cfg["routes"]})
        players = FakePlayers()
        app = create_app(store=store, engines_factory=fake_engines, input_factory=None, players=players,
                         output_resolver=lambda name: 12 if name == "CABLE Input" else None)
        with TestClient(app) as c:
            c.post("/api/start")
            for _ in range(100):
                if c.get("/api/status").json()["state"] == "running":
                    break
                time.sleep(0.05)
            r = c.post("/api/test", json={"channel": "zh", "text": "Good morning"}).json()
            self.assertEqual(r["translation"], "[zh] Good morning")
            self.assertEqual(players.played[0][0], 12)
            logs = "\n".join(c.get("/api/status").json()["logs"])
            self.assertIn("'CABLE Input' (#12)", logs)
            c.post("/api/stop")

    def test_missing_cable_is_a_warning_not_a_failure(self):
        store = ConfigStore(self.cfg_path, preset=PRESET)
        cfg = store.get()
        cfg["routes"][0]["input"] = {"type": "browser", "device": None}
        store.update({"routes": cfg["routes"]})
        app = create_app(store=store, engines_factory=fake_engines, input_factory=None,
                         players=FakePlayers(), output_resolver=lambda n: None)
        with TestClient(app) as c:
            c.post("/api/start")
            for _ in range(100):
                st = c.get("/api/status").json()
                if st["state"] == "running":
                    break
                time.sleep(0.05)
            self.assertEqual(st["state"], "running")
            self.assertIn("not found on this PC", "\n".join(st["logs"]))
            c.post("/api/stop")


class SelfTestTests(unittest.TestCase):
    def test_selftest_runs_end_to_end_with_fakes(self):
        import io
        import os
        from contextlib import redirect_stdout
        from unittest import mock

        from translator import selftest

        with tempfile.TemporaryDirectory() as d:
            store = ConfigStore(Path(d) / "config.json", preset=PRESET)
            buf = io.StringIO()
            with mock.patch("translator.engines.build_engines", fake_engines), \
                 mock.patch.object(selftest, "DATA_DIR", Path(d)), redirect_stdout(buf):
                code = selftest.run(store)
            out = buf.getvalue()
            self.assertIn("Mandarin:   [zh] hello", out)
            self.assertTrue(os.path.exists(Path(d) / "selftest-zh.wav"))
            # sound devices are missing in CI, so that check reports FAIL (exit 1) but the AI test still ran
            self.assertIn(code, (0, 1))


if __name__ == "__main__":
    unittest.main()
