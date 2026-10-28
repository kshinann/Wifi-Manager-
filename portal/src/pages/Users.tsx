import { useState } from "react";
import { api, type Role, type User } from "../api";
import { useAuth, useCan } from "../auth";
import { ErrorText } from "../components/ui";
import { fmtDate, useApi } from "../hooks";

export default function Users() {
  const { session } = useAuth();
  const isOwner = useCan("owner");
  const users = useApi<User[]>("/api/users");
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "viewer" as Role });
  const [error, setError] = useState<string | null>(null);
  const roles: Role[] = isOwner ? ["viewer", "admin", "owner"] : ["viewer", "admin"];

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      users.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <div className="page-head"><h1>Portal users</h1></div>
      <p className="subtle">Viewers see dashboards and logs. Admins manage devices and policies and can read recorded prompts.
        Owners also manage users and organization settings.</p>
      <ErrorText error={error || users.error} />
      <form className="card form-grid" onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api("/api/users", { method: "POST", body: form });
          setForm({ email: "", name: "", password: "", role: "viewer" });
        });
      }}>
        <label className="field">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field">Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="field">Initial password<input required minLength={10} type="password" autoComplete="new-password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <label className="field">Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {roles.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <div className="row" style={{ alignItems: "end" }}><button className="primary">Add user</button></div>
      </form>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.data?.map((u) => {
              const self = u.id === session?.user.id;
              const locked = self || (u.role === "owner" && !isOwner);
              return (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} disabled={locked} aria-label={`Role for ${u.email}`}
                            onChange={(e) => run(() => api(`/api/users/${u.id}`, { method: "PATCH", body: { role: e.target.value } }))}>
                      {(u.role === "owner" ? ["viewer", "admin", "owner"] : roles).map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>{fmtDate(u.last_login_at)}</td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={u.is_active} disabled={locked}
                             onChange={(e) => run(() => api(`/api/users/${u.id}`, { method: "PATCH", body: { is_active: e.target.checked } }))} />
                      active
                    </label>
                  </td>
                  <td>{isOwner && !self && (
                    <button className="link danger" onClick={() => {
                      if (confirm(`Delete ${u.email}?`)) run(() => api(`/api/users/${u.id}`, { method: "DELETE" }));
                    }}>Delete</button>
                  )}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
