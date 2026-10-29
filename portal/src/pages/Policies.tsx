import { useState } from "react";
import { api, type Action, type Policy, type PolicyRules, type Tool } from "../api";
import { useCan } from "../auth";
import { ErrorText, Modal } from "../components/ui";
import { fmtDate, useApi } from "../hooks";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DETECTOR_LABELS: Record<string, string> = {
  credentials: "Passwords, PINs, OTP/TAC & logins",
  bank_account: "Bank account numbers",
  email: "Email addresses", credit_card: "Credit card numbers", phone: "Phone numbers",
  api_key: "API keys & secrets", my_nric: "Malaysian IC (MyKad) numbers", ip_address: "IP addresses", iban: "IBAN bank accounts",
};

function summarize(r: PolicyRules): string {
  const parts = [];
  const blocked = r.tool_rules.filter((t) => t.action === "block").length;
  if (r.default_action !== "allow") parts.push(`unlisted tools: ${r.default_action}`);
  if (blocked) parts.push(`${blocked} blocked`);
  if (r.tool_rules.some((t) => t.daily_minutes !== null) || r.daily_minutes_total !== null) parts.push("time limits");
  if (r.schedule) parts.push(`hours ${r.schedule.start}–${r.schedule.end}`);
  if (r.dlp.enabled) parts.push(`DLP: ${r.dlp.action}`);
  if (r.capture_prompts) parts.push("records prompts");
  return parts.join(" · ") || "monitor only";
}

export default function Policies() {
  const isAdmin = useCan("admin");
  const policies = useApi<Policy[]>("/api/policies");
  const tools = useApi<Tool[]>("/api/tools");
  const template = useApi<{ rules: PolicyRules; dlp_detectors: string[] }>("/api/policies/template");
  const [editing, setEditing] = useState<Partial<Policy> | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Policies</h1>
        {isAdmin && template.data && (
          <button className="primary" onClick={() => setEditing({ name: "", description: "", is_default: false,
                                                                  rules: structuredClone(template.data!.rules) })}>
            New policy
          </button>
        )}
      </div>
      <ErrorText error={error || policies.error} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Rules</th><th className="num">Version</th><th>Updated</th><th /></tr></thead>
          <tbody>
            {policies.data?.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => setEditing(structuredClone(p))}>
                <td>{p.name} {p.is_default && <span className="badge">default</span>}
                  <div className="subtle">{p.description}</div></td>
                <td>{summarize(p.rules)}</td>
                <td className="num">{p.version}</td>
                <td>{fmtDate(p.updated_at)}</td>
                <td>{isAdmin && !p.is_default && (
                  <button className="link danger" onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm(`Delete policy ${p.name}? Groups using it fall back to the default policy.`)) return;
                    try {
                      await api(`/api/policies/${p.id}`, { method: "DELETE" });
                      policies.reload();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}>Delete</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && tools.data && template.data && (
        <PolicyEditor policy={editing} tools={tools.data} detectors={template.data.dlp_detectors} readOnly={!isAdmin}
                      onClose={() => setEditing(null)} onSaved={() => { setEditing(null); policies.reload(); }} />
      )}
    </div>
  );
}

function PolicyEditor({ policy, tools, detectors, readOnly, onClose, onSaved }: {
  policy: Partial<Policy>; tools: Tool[]; detectors: string[]; readOnly: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [p, setP] = useState(policy);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rules = p.rules!;
  const setRules = (patch: Partial<PolicyRules>) => setP({ ...p, rules: { ...rules, ...patch } });

  function setToolRule(key: string, action: Action | "", minutes: string) {
    const others = rules.tool_rules.filter((r) => r.tool !== key);
    const daily = minutes === "" ? null : Math.max(0, Number(minutes));
    if (action === "" && daily === null) return setRules({ tool_rules: others });
    setRules({ tool_rules: [...others, { tool: key, action: action || rules.default_action, daily_minutes: daily }] });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body = { name: p.name, description: p.description, is_default: p.is_default, rules };
      if (p.id) await api(`/api/policies/${p.id}`, { method: "PUT", body });
      else await api("/api/policies", { method: "POST", body });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const num = (v: string) => (v === "" ? null : Number(v));

  return (
    <Modal title={p.id ? `Edit ${p.name}` : "New policy"} onClose={onClose}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <div className="form-grid">
          <label className="field">Name<input required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
          <label className="field">Description<input value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></label>
        </div>
        <label className="check">
          <input type="checkbox" checked={!!p.is_default} disabled={!!policy.is_default}
                 onChange={(e) => setP({ ...p, is_default: e.target.checked })} />
          Default policy for devices without a group policy
        </label>

        <h3>AI tools</h3>
        <label className="field" style={{ maxWidth: 320 }}>Tools without their own rule
          <select value={rules.default_action} onChange={(e) => setRules({ default_action: e.target.value as Action })}>
            <option value="allow">Allow</option><option value="warn">Warn</option><option value="block">Block</option>
          </select>
        </label>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tool</th><th>Access</th><th>Daily limit (min)</th></tr></thead>
            <tbody>
              {tools.map((t) => {
                const r = rules.tool_rules.find((x) => x.tool === t.key);
                return (
                  <tr key={t.key}>
                    <td>{t.name}<div className="subtle">{t.category}</div></td>
                    <td>
                      <select aria-label={`Access for ${t.name}`} value={r ? r.action : ""}
                              onChange={(e) => setToolRule(t.key, e.target.value as Action | "", r?.daily_minutes?.toString() ?? "")}>
                        <option value="">Default ({rules.default_action})</option>
                        <option value="allow">Allow</option><option value="warn">Warn</option><option value="block">Block</option>
                      </select>
                    </td>
                    <td>
                      <input type="number" min={0} max={1440} style={{ width: 100 }} aria-label={`Daily limit for ${t.name}`}
                             placeholder="none" value={r?.daily_minutes ?? ""}
                             onChange={(e) => setToolRule(t.key, r ? r.action : "", e.target.value)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h3>Time limits</h3>
        <div className="form-grid">
          <label className="field">Total AI time per day (min)
            <input type="number" min={0} max={1440} placeholder="no limit" value={rules.daily_minutes_total ?? ""}
                   onChange={(e) => setRules({ daily_minutes_total: num(e.target.value) })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={!!rules.schedule}
                 onChange={(e) => setRules({ schedule: e.target.checked
                   ? { days: [0, 1, 2, 3, 4], start: "08:00", end: "18:00", outside_action: "block" } : null })} />
          Only allow AI tools during set hours (device local time)
        </label>
        {rules.schedule && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row">
              {DAYS.map((d, i) => (
                <label key={d} className="check">
                  <input type="checkbox" checked={rules.schedule!.days.includes(i)} onChange={(e) => setRules({
                    schedule: { ...rules.schedule!, days: e.target.checked
                      ? [...rules.schedule!.days, i].sort() : rules.schedule!.days.filter((x) => x !== i) },
                  })} />{d}
                </label>
              ))}
            </div>
            <div className="form-grid">
              <label className="field">From<input type="time" value={rules.schedule.start}
                onChange={(e) => setRules({ schedule: { ...rules.schedule!, start: e.target.value } })} /></label>
              <label className="field">Until<input type="time" value={rules.schedule.end}
                onChange={(e) => setRules({ schedule: { ...rules.schedule!, end: e.target.value } })} /></label>
              <label className="field">Outside these hours
                <select value={rules.schedule.outside_action}
                        onChange={(e) => setRules({ schedule: { ...rules.schedule!, outside_action: e.target.value as "warn" | "block" } })}>
                  <option value="block">Block</option><option value="warn">Warn</option>
                </select>
              </label>
            </div>
          </div>
        )}

        <h3>Prompts & sensitive data</h3>
        <label className="check">
          <input type="checkbox" checked={rules.dlp.enabled} onChange={(e) => setRules({ dlp: { ...rules.dlp, enabled: e.target.checked } })} />
          Check prompts for sensitive data before they are sent
        </label>
        {rules.dlp.enabled && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="row">
              {detectors.map((d) => (
                <label key={d} className="check">
                  <input type="checkbox" checked={rules.dlp.detectors.includes(d)} onChange={(e) => setRules({
                    dlp: { ...rules.dlp, detectors: e.target.checked ? [...rules.dlp.detectors, d] : rules.dlp.detectors.filter((x) => x !== d) },
                  })} />{DETECTOR_LABELS[d] || d}
                </label>
              ))}
            </div>
            <label className="field">Blocked keywords (one per line, e.g. project code names)
              <textarea value={rules.dlp.keywords.join("\n")} onChange={(e) => setRules({
                dlp: { ...rules.dlp, keywords: e.target.value.split("\n").map((k) => k.trim()).filter(Boolean) } })} />
            </label>
            <label className="field" style={{ maxWidth: 320 }}>When found
              <select value={rules.dlp.action} onChange={(e) => setRules({ dlp: { ...rules.dlp, action: e.target.value as "log" | "warn" | "block" } })}>
                <option value="log">Log only</option><option value="warn">Warn the user</option><option value="block">Block the prompt</option>
              </select>
            </label>
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={rules.capture_prompts} onChange={(e) => setRules({ capture_prompts: e.target.checked })} />
          Record full prompt text
        </label>
        {rules.capture_prompts && (
          <div className="stack" style={{ gap: 8 }}>
            <p className="notice">
              Users will see a notice on AI sites that their prompts are recorded. Passwords, card and bank numbers,
              IC numbers and other detected values are masked on the PC before upload, and stored prompts are
              encrypted. Make sure your employee monitoring notice and local privacy law (e.g. PDPA) cover this.
              Only admins and owners can read recorded prompts.
            </p>
            <label className="field" style={{ maxWidth: 320 }}>Keep recorded prompts for (days)
              <input type="number" min={1} max={3650} value={rules.prompt_retention_days}
                     onChange={(e) => setRules({ prompt_retention_days: Number(e.target.value) || 30 })} />
            </label>
          </div>
        )}

        <h3>Monitoring & enforcement</h3>
        {([
          ["monitor_processes", "Detect AI desktop apps (ChatGPT, Claude, Cursor, Ollama…)"],
          ["monitor_network", "Detect AI traffic from other apps and scripts"],
          ["enforce_processes", "Close blocked desktop apps"],
          ["enforce_hosts_file", "Block blocked tools for all browsers and apps (hosts file)"],
        ] as [keyof PolicyRules, string][]).map(([k, label]) => (
          <label key={k} className="check">
            <input type="checkbox" checked={!!rules[k]} onChange={(e) => setRules({ [k]: e.target.checked } as Partial<PolicyRules>)} />
            {label}
          </label>
        ))}

        <h3>Messages shown to users</h3>
        <label className="field">Warning<textarea value={rules.warn_message} onChange={(e) => setRules({ warn_message: e.target.value })} /></label>
        <label className="field">Block<textarea value={rules.block_message} onChange={(e) => setRules({ block_message: e.target.value })} /></label>
      </fieldset>
      <ErrorText error={error} />
      {!readOnly && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary" disabled={saving || !p.name} onClick={save}>{saving ? "Saving…" : "Save policy"}</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      )}
    </Modal>
  );
}
