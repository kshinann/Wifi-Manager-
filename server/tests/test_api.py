import os
import uuid
from datetime import datetime, timezone

import pytest

os.environ["DATABASE_URL"] = "sqlite:///./test-aiguard.db"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["PLATFORM_ADMIN_EMAIL"] = "root@aiguard-platform.com"
os.environ["PLATFORM_ADMIN_PASSWORD"] = "platform-password"

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(engine)


def signup(client, company, email):
    r = client.post("/api/auth/signup", json={"company_name": company, "name": "Owner", "email": email,
                                              "password": "correct-horse-battery"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def enroll(client, headers, group_id=None):
    r = client.post("/api/enrollment-tokens", json={"label": "laptops", "group_id": group_id}, headers=headers)
    assert r.status_code == 201, r.text
    r = client.post("/api/agent/enroll", json={"enrollment_token": r.json()["token"], "hostname": "PC-01",
                                               "os": "windows", "os_user": "alice"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['device_token']}"}


def event(**overrides):
    base = {"id": uuid.uuid4().hex, "tool_key": "chatgpt", "source": "browser", "event_type": "prompt",
            "action": "allowed", "domain": "chatgpt.com", "occurred_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": 0, "prompt_chars": 11, "prompt_text": "hello world"}
    base.update(overrides)
    return base


def test_tenant_isolation(client):
    a = signup(client, "Acme", "a@acme-corp.com")
    b = signup(client, "Beta", "b@beta-corp.com")
    policy_a = client.get("/api/policies", headers=a).json()[0]
    assert client.get(f"/api/policies/{policy_a['id']}", headers=b).status_code == 404
    enroll(client, a)
    assert len(client.get("/api/devices", headers=a).json()) == 1
    assert client.get("/api/devices", headers=b).json() == []


def test_prompt_text_dropped_unless_capture_enabled(client):
    admin = signup(client, "Acme", "a@acme-corp.com")
    device = enroll(client, admin)
    ev = event()
    r = client.post("/api/agent/events", json={"events": [ev, ev]}, headers=device)
    assert r.json() == {"accepted": 1, "duplicates": 1}
    items = client.get("/api/usage/events", headers=admin).json()["items"]
    assert items[0]["prompt_text"] is None and items[0]["prompt_chars"] == 11

    policy = client.get("/api/policies", headers=admin).json()[0]
    rules = policy["rules"] | {"capture_prompts": True}
    r = client.put(f"/api/policies/{policy['id']}", json={"rules": rules}, headers=admin)
    assert r.json()["version"] == 2
    cfg = client.get("/api/agent/config", headers=device).json()
    assert cfg["policy"]["capture_prompts"] is True
    client.post("/api/agent/events", json={"events": [event()]}, headers=device)
    items = client.get("/api/usage/events", headers=admin).json()["items"]
    assert any(i["prompt_text"] == "hello world" for i in items)


def test_prompt_text_encrypted_at_rest(client):
    from sqlalchemy import text

    admin = signup(client, "Acme", "a@acme-corp.com")
    device = enroll(client, admin)
    policy = client.get("/api/policies", headers=admin).json()[0]
    client.put(f"/api/policies/{policy['id']}", json={"rules": policy["rules"] | {"capture_prompts": True}},
               headers=admin)
    client.post("/api/agent/events", json={"events": [event(prompt_text="password: ********")]}, headers=device)
    with engine.connect() as conn:
        stored = conn.execute(text("SELECT prompt_text FROM usage_events")).scalar_one()
    assert stored.startswith("enc:v1:") and "password" not in stored
    items = client.get("/api/usage/events", headers=admin).json()["items"]
    assert items[0]["prompt_text"] == "password: ********"


def test_group_policy_overrides_default(client):
    admin = signup(client, "Acme", "a@acme-corp.com")
    rules = client.get("/api/policies/template", headers=admin).json()["rules"]
    rules["tool_rules"] = [{"tool": "deepseek", "action": "block"}]
    strict = client.post("/api/policies", json={"name": "Strict", "rules": rules}, headers=admin).json()
    group = client.post("/api/groups", json={"name": "Finance", "policy_id": strict["id"]}, headers=admin).json()
    device = enroll(client, admin, group_id=group["id"])
    cfg = client.get("/api/agent/config", headers=device).json()
    assert cfg["policy"]["tool_rules"] == [{"tool": "deepseek", "action": "block", "daily_minutes": None}]
    assert any(t["key"] == "chatgpt" for t in cfg["tools"])


def test_invalid_policy_rejected(client):
    admin = signup(client, "Acme", "a@acme-corp.com")
    bad = {"name": "Bad", "rules": {"schedule": {"start": "25:00"}}}
    assert client.post("/api/policies", json=bad, headers=admin).status_code == 422


def test_viewer_cannot_read_prompts_or_edit(client):
    admin = signup(client, "Acme", "a@acme-corp.com")
    client.post("/api/users", json={"email": "v@acme-corp.com", "name": "V", "password": "viewer-password",
                                    "role": "viewer"}, headers=admin)
    token = client.post("/api/auth/login", json={"email": "v@acme-corp.com", "password": "viewer-password"}).json()
    viewer = {"Authorization": f"Bearer {token['access_token']}"}
    assert client.post("/api/groups", json={"name": "X"}, headers=viewer).status_code == 403
    assert client.get("/api/usage/summary", headers=viewer).status_code == 200


def test_revoked_device_rejected(client):
    admin = signup(client, "Acme", "a@acme-corp.com")
    device = enroll(client, admin)
    device_id = client.get("/api/devices", headers=admin).json()[0]["id"]
    client.delete(f"/api/devices/{device_id}", headers=admin)
    assert client.get("/api/agent/config", headers=device).status_code == 401


def test_summary(client):
    admin = signup(client, "Acme", "a@acme-corp.com")
    device = enroll(client, admin)
    client.post("/api/agent/events", json={"events": [
        event(event_type="session", duration_seconds=600, prompt_text=None, prompt_chars=None),
        event(event_type="blocked", action="blocked", tool_key="deepseek", prompt_text=None, prompt_chars=None),
    ]}, headers=device)
    s = client.get("/api/usage/summary?days=7", headers=admin).json()
    assert s["totals"]["minutes"] == 10.0
    assert s["totals"]["blocked"] == 1
    assert {t["tool_key"] for t in s["by_tool"]} == {"chatgpt", "deepseek"}


def test_platform_admin(client):
    signup(client, "Acme", "a@acme-corp.com")
    token = client.post("/api/auth/login", json={"email": "root@aiguard-platform.com",
                                                 "password": "platform-password"}).json()["access_token"]
    tenants = client.get("/api/platform/tenants", headers={"Authorization": f"Bearer {token}"}).json()
    assert [t["name"] for t in tenants] == ["Acme"]
