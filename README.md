# AI Guard

Monitor, record and control how people use AI tools (ChatGPT, Claude, Gemini, Copilot, Cursor, DeepSeek, local
models, …) on company Windows and macOS PCs, from one multi-tenant management portal.

| Component | Path | What it does |
|---|---|---|
| Management server | `server/` | FastAPI + PostgreSQL. Multi-tenant API for the portal and the agents. |
| Management portal | `portal/` | React web app: dashboard, usage log, devices, groups, policies, AI tool catalog, users. |
| Desktop agent | `agent/` | Python service for Windows/macOS. Detects AI apps and AI network traffic, enforces policy, uploads usage. |
| Browser extension | `extension/` | Chrome/Edge (MV3). Detects AI websites, blocks/warns, checks prompts for sensitive data, records prompts when policy allows. |

See [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## What it can do

**Detect AI usage** (all three combined):
- **Browser extension**: visits to AI sites, time spent (only while the tab is focused and the user is active), prompt submissions.
- **Desktop app monitor**: AI apps by process name (ChatGPT, Claude, Copilot, Perplexity, Cursor, Windsurf, Ollama, LM Studio, …) and how long they run.
- **Network monitor**: connections to AI API endpoints (`api.openai.com`, `api.anthropic.com`, …) from any process, so scripts, IDE plugins and browsers without the extension are seen too.

**Policies** (assigned per group, with a tenant-wide default):
- Per tool: allow, warn (interstitial the user must acknowledge) or block. Also a default for tools without their own rule.
- Daily time limits per tool and in total, plus allowed hours/days (e.g. Mon–Fri 08:00–18:00).
- Sensitive-data checks on prompts (credit cards with Luhn check, API keys, Malaysian MyKad numbers, emails, phone numbers, IPs, IBANs, custom keywords) with the action log, warn or block.
- Prompt recording: **off by default**, enabled per policy, with its own retention period. Users see a notice on AI sites when it's on. Only admins and owners can read recorded prompts.
- Enforcement: the browser redirects blocked sites before they load, the agent closes blocked desktop apps, and the hosts file blocks the domains for every other browser and app.

**Portal**:
- Dashboard: time in AI tools, prompts, blocks, sensitive-data hits, a per-day trend, and the top tools, devices and users.
- Searchable, filterable usage log with CSV export.
- Device enrollment tokens, groups, a policy editor, the tool catalog (add your own tools), users with roles (owner, admin, viewer).
- Platform admin view to create and suspend tenants (SaaS mode).

## Quick start (Docker Compose)

```bash
cp .env.example .env        # set passwords, SECRET_KEY, platform admin
docker compose up -d --build
```

Open http://localhost:8080 and sign in as the platform admin. Create a tenant, or set `ALLOW_SIGNUP=true` so
organizations can sign up themselves. For production, put a TLS reverse proxy (Caddy, nginx, Traefik or a cloud
load balancer) in front of port 8080. Agents need HTTPS to reach the server.

## Rolling out to PCs

1. **Portal → Devices → Enroll devices**: pick a group and create a token. Copy it; it's shown only once.
2. **Build the agent** on each OS (PyInstaller doesn't cross-compile):
   ```bash
   cd agent
   pip install pyinstaller psutil
   pyinstaller --distpath dist packaging/aiguard-agent.spec
   ```
3. **Publish the extension.** Upload `extension/` to the Chrome Web Store (unlisted is fine) and/or Edge Add-ons, or
   self-host the CRX. Note the extension ID.
4. **Install**, by hand or through Intune, GPO, SCCM, Jamf or Kandji. Put the built binary next to the install script
   (`agent/packaging/windows/` or `agent/packaging/macos/`) first:
   - Windows (elevated): `.\install.ps1 -Server https://aiguard.yourcompany.com -Token enr_... -ExtensionId <id>`
     installs the agent as a SYSTEM startup task. It also force-installs the extension in Chrome and Edge through
     policy, so users can't remove it.
   - macOS: `sudo ./install.sh --server https://aiguard.yourcompany.com --token enr_... --extension-id <id>`
     installs a launchd daemon. Force-install the extension with a configuration profile
     (`ExtensionInstallForcelist`) from your MDM.
5. The device appears under **Devices** within a minute. Usage shows up as soon as someone uses an AI tool.

Uninstall scripts are next to the installers. They remove the hosts-file block too.

## Development

```bash
# server (Python 3.12)
cd server && pip install -r requirements-dev.txt
uvicorn app.main:app --reload            # SQLite by default
pytest

# portal
cd portal && npm install && npm run dev  # proxies /api to localhost:8000

# agent
cd agent && pip install psutil
python -m unittest discover -s tests
AIGUARD_DATA_DIR=./.data python -m aiguard_agent enroll --server http://localhost:8000 --token enr_...
AIGUARD_DATA_DIR=./.data python -m aiguard_agent run -v

# extension: chrome://extensions → Developer mode → Load unpacked → extension/
```

## Privacy and legal

Monitoring employees' AI use, and especially recording prompts, is personal-data processing. Before enabling it,
make sure your employee monitoring notice, acceptable-use policy and local law cover it (Malaysia's PDPA 2010, or GDPR
for EU staff). AI Guard keeps prompt recording off by default, shows users a notice when it's on, limits who can
read prompts, and deletes them after the policy's retention period.

## Known limitations (MVP)

- Tables are created at startup. Add Alembic migrations before the first production schema change.
- Prompt interception uses site-specific selectors (ChatGPT, Claude, Gemini, Copilot, and a generic fallback). AI
  sites change their markup, so these need upkeep.
- The browser extension covers Chrome and Edge. Firefox and Safari are only covered by the network monitor and
  hosts-file blocking (no prompt checks).
- Desktop app usage counts the time the app runs, not foreground time.
- An administrator on the PC can stop the agent. Use standard user accounts and MDM tamper protection.
- Portal authentication is email + password (JWT). SSO (Entra ID/Google) isn't implemented yet.
