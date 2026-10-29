# Architecture

```
 User PC (Windows / macOS)                                   Cloud / server
┌───────────────────────────────────────────────┐          ┌─────────────────────────────┐
│ Chrome / Edge                                  │          │  portal (nginx + React)     │
│  └─ AI Guard extension ──┐ 127.0.0.1:47615     │          │        │ /api               │
│                          ▼                     │  HTTPS   │        ▼                    │
│ AI Guard agent (SYSTEM / root)  ───────────────┼─────────▶│  server (FastAPI)           │
│  ├─ process monitor   (AI desktop apps)        │ device   │        │                    │
│  ├─ network monitor   (AI API traffic)         │ token    │        ▼                    │
│  ├─ policy engine     (allow/warn/block,       │          │  PostgreSQL                 │
│  │                     hours, quotas, DLP)     │          │  tenants, users, groups,    │
│  ├─ enforcement       (close apps, hosts file) │          │  policies, devices,         │
│  └─ outbox (SQLite)   (offline queue)          │          │  usage_events               │
└───────────────────────────────────────────────┘          └─────────────────────────────┘
```

## Data flow

1. **Enrollment.** An admin creates an enrollment token in the portal. The installer calls
   `POST /api/agent/enroll` with it and receives a per-device token. Only the token's SHA-256 is stored on the server.
2. **Policy.** Every 60 s the agent calls `GET /api/agent/config` and receives the device's effective policy and the
   AI tool catalog. The effective policy is the group's policy if set, else the tenant default. The agent caches it,
   so enforcement keeps working offline.
3. **Decisions are made locally.** `agent/aiguard_agent/policy.py` combines the tool rule, the default action, the
   schedule, the per-tool daily limit and the total daily limit. The most severe outcome wins. Daily usage is counted
   on the PC's local day.
4. **Browser.** The extension asks the agent over loopback HTTP:
   - `GET /v1/policy` returns tools and per-tool decisions. Blocked tools become `declarativeNetRequest` redirect
     rules, so the page never loads.
   - `POST /v1/visit` runs on each navigation to an AI site and returns allow, warn (interstitial) or block.
   - `POST /v1/activity` reports 30 s of focused, non-idle use and can block mid-session when a limit is reached.
   - `POST /v1/prompt`: the content script holds the submission, the agent runs DLP and returns allow, warn or
     block, and the text is kept only if the policy records prompts.

   The local API requires an `X-AIGuard-Client` header. Web pages can't send it cross-origin without a CORS
   preflight, and the agent answers preflights only for extension origins. POSTs must come from an extension
   origin, which can be pinned to specific extension IDs with `--extension-id`.
5. **Desktop apps and network.** Every 5 s the agent matches running processes against the catalog. Every 30 s it
   matches TCP connections (and the Windows DNS cache) against catalog domains. Network hits that come from a
   browser with a live extension are skipped to avoid double counting.
6. **Upload.** Events go into a local SQLite outbox and are sent in batches of up to 200 to `POST /api/agent/events`.
   Each event has a client-generated ID, so retries are deduplicated. The agent masks sensitive values in
   `prompt_text` before queuing it, the server drops `prompt_text` unless the device's current policy enables
   recording, and the server stores it encrypted (AES-256-GCM, key from `PROMPT_ENCRYPTION_KEY`).
7. **Retention.** A background job on the server clears prompt text after the policy's retention period and deletes
   events older than the tenant's `event_retention_days`.

## Multi-tenancy

Every tenant-owned row has a `tenant_id`. Portal endpoints scope every query to the signed-in user's tenant, and
agent endpoints scope to the device's tenant. Roles:

| Role | Can |
|---|---|
| viewer | see dashboard, usage log (no prompt text), devices, groups, policies, tools |
| admin | everything a viewer can, plus manage devices, tokens, groups, policies, tools and users (not owners), read recorded prompts |
| owner | everything an admin can, plus manage owners and tenant settings |
| platform admin | create, list and suspend tenants (SaaS operator) |

## Event model

| field | values |
|---|---|
| `source` | `browser`, `process`, `network` |
| `event_type` | `visit`, `session` (with `duration_seconds`), `prompt`, `dlp` (prompt with sensitive-data hits), `warned`, `blocked` |
| `action` | `allowed`, `warned`, `blocked` |

## Policy document

Stored as JSON in `policies.rules`, validated by `server/app/policy_schema.py`:

```json
{
  "default_action": "allow",
  "tool_rules": [{"tool": "deepseek", "action": "block", "daily_minutes": null},
                 {"tool": "chatgpt", "action": "warn", "daily_minutes": 60}],
  "daily_minutes_total": 120,
  "schedule": {"days": [0,1,2,3,4], "start": "08:00", "end": "18:00", "outside_action": "block"},
  "capture_prompts": false,
  "prompt_retention_days": 30,
  "dlp": {"enabled": true, "detectors": ["credit_card", "api_key", "my_nric"], "keywords": ["project falcon"], "action": "block"},
  "monitor_processes": true, "monitor_network": true,
  "enforce_processes": true, "enforce_hosts_file": true,
  "warn_message": "…", "block_message": "…"
}
```
