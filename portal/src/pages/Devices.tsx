import { useState } from "react";
import { api, type Device, type EnrollmentToken, type Group } from "../api";
import { useCan } from "../auth";
import { CopyButton, ErrorText, Modal, StatusBadge } from "../components/ui";
import { fmtDate, timeAgo, useApi } from "../hooks";

const STALE_MS = 15 * 60 * 1000;

export default function Devices() {
  const isAdmin = useCan("admin");
  const devices = useApi<Device[]>("/api/devices");
  const groups = useApi<Group[]>("/api/groups");
  const tokens = useApi<EnrollmentToken[]>(isAdmin ? "/api/enrollment-tokens" : null);
  const [enrolling, setEnrolling] = useState(false);
  const [created, setCreated] = useState<EnrollmentToken | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groupName = (id: string | null) => groups.data?.find((g) => g.id === id)?.name || "No group";

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Devices</h1>
        {isAdmin && <button className="primary" onClick={() => setEnrolling(true)}>Enroll devices</button>}
      </div>
      <ErrorText error={error || devices.error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Hostname</th><th>OS</th><th>User</th><th>Group</th><th>Agent</th><th>Last seen</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {devices.data?.map((d) => {
              const stale = !d.last_seen_at || Date.now() - new Date(d.last_seen_at).getTime() > STALE_MS;
              return (
                <tr key={d.id}>
                  <td>{d.hostname}</td>
                  <td>{d.os}<div className="subtle">{d.os_version}</div></td>
                  <td>{d.os_user}</td>
                  <td>
                    {isAdmin ? (
                      <select value={d.group_id || ""} aria-label={`Group for ${d.hostname}`}
                              onChange={(e) => run(async () => {
                                await api(`/api/devices/${d.id}`, { method: "PATCH", body: { group_id: e.target.value || null } });
                                devices.reload();
                              })}>
                        <option value="">No group</option>
                        {groups.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    ) : groupName(d.group_id)}
                  </td>
                  <td>{d.agent_version}</td>
                  <td title={fmtDate(d.last_seen_at)}>{timeAgo(d.last_seen_at)}</td>
                  <td>{stale ? <span className="badge warning">! offline</span> : <StatusBadge value={d.status} />}</td>
                  <td>
                    {isAdmin && (
                      <button className="link danger" onClick={() => {
                        if (confirm(`Revoke ${d.hostname}? The agent will stop reporting. History is kept.`)) {
                          run(async () => { await api(`/api/devices/${d.id}`, { method: "DELETE" }); devices.reload(); });
                        }
                      }}>Revoke</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {devices.data?.length === 0 && <p className="subtle">No devices enrolled yet.</p>}
      </div>

      {isAdmin && tokens.data && tokens.data.length > 0 && (
        <div className="card table-wrap">
          <h2>Enrollment tokens</h2>
          <table>
            <thead><tr><th>Label</th><th>Token</th><th>Group</th><th className="num">Uses</th><th>Expires</th><th /></tr></thead>
            <tbody>
              {tokens.data.map((t) => (
                <tr key={t.id}>
                  <td>{t.label || "—"}</td>
                  <td className="mono">{t.token_prefix}…</td>
                  <td>{groupName(t.group_id)}</td>
                  <td className="num">{t.uses}{t.max_uses ? ` / ${t.max_uses}` : ""}</td>
                  <td>{t.revoked ? <span className="badge critical">✕ revoked</span> : fmtDate(t.expires_at)}</td>
                  <td>{!t.revoked && (
                    <button className="link danger" onClick={() => run(async () => {
                      await api(`/api/enrollment-tokens/${t.id}`, { method: "DELETE" });
                      tokens.reload();
                    })}>Revoke</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {enrolling && (
        <EnrollModal groups={groups.data || []} created={created}
                     onCreate={(t) => { setCreated(t); tokens.reload(); }}
                     onClose={() => { setEnrolling(false); setCreated(null); }} />
      )}
    </div>
  );
}

function EnrollModal({ groups, created, onCreate, onClose }: {
  groups: Group[]; created: EnrollmentToken | null; onCreate: (t: EnrollmentToken) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({ label: "", group_id: "", max_uses: "", expires_in_days: "30" });
  const [error, setError] = useState<string | null>(null);
  const server = window.location.origin;

  async function create() {
    setError(null);
    try {
      onCreate(await api<EnrollmentToken>("/api/enrollment-tokens", {
        method: "POST",
        body: { label: form.label, group_id: form.group_id || null,
                max_uses: form.max_uses ? Number(form.max_uses) : null,
                expires_in_days: form.expires_in_days ? Number(form.expires_in_days) : null },
      }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (created?.token) {
    const win = `.\\install.ps1 -Server ${server} -Token ${created.token}`;
    const mac = `sudo ./install.sh --server ${server} --token ${created.token}`;
    return (
      <Modal title="Enrollment token created" onClose={onClose}>
        <p className="notice">Copy this token now. It will not be shown again.</p>
        <div className="row"><code className="secret" style={{ flex: 1 }}>{created.token}</code><CopyButton text={created.token} /></div>
        <h3>Windows (elevated PowerShell, or deploy with Intune/GPO)</h3>
        <div className="row"><code className="secret" style={{ flex: 1 }}>{win}</code><CopyButton text={win} /></div>
        <h3>macOS (Terminal, or deploy with your MDM)</h3>
        <div className="row"><code className="secret" style={{ flex: 1 }}>{mac}</code><CopyButton text={mac} /></div>
      </Modal>
    );
  }

  return (
    <Modal title="Enroll devices" onClose={onClose}>
      <p className="subtle">Create a token, then run the installer on each PC. Devices join the selected group.</p>
      <div className="form-grid">
        <label className="field">Label<input value={form.label} placeholder="e.g. Finance laptops"
                                            onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
        <label className="field">Group
          <select value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
            <option value="">No group (default policy)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="field">Max devices<input type="number" min={1} value={form.max_uses} placeholder="unlimited"
                                                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></label>
        <label className="field">Expires in (days)<input type="number" min={1} value={form.expires_in_days}
                                                        onChange={(e) => setForm({ ...form, expires_in_days: e.target.value })} /></label>
      </div>
      <ErrorText error={error} />
      <div className="row" style={{ marginTop: 16 }}><button className="primary" onClick={create}>Create token</button></div>
    </Modal>
  );
}
