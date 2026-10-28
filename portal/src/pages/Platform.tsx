import { useState } from "react";
import { api, type Tenant } from "../api";
import { ErrorText } from "../components/ui";
import { fmtDate, useApi } from "../hooks";

type TenantRow = Tenant & { devices: number; users: number };

export default function Platform() {
  const tenants = useApi<TenantRow[]>("/api/platform/tenants");
  const [form, setForm] = useState({ company_name: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      tenants.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <div className="page-head"><h1>Tenants</h1></div>
      <ErrorText error={error || tenants.error} />
      <form className="card form-grid" onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          await api("/api/platform/tenants", { method: "POST", body: form });
          setForm({ company_name: "", name: "", email: "", password: "" });
        });
      }}>
        <label className="field">Organization<input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></label>
        <label className="field">Owner name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field">Owner email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="field">Initial password<input required minLength={10} type="password" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <div className="row" style={{ alignItems: "end" }}><button className="primary">Create tenant</button></div>
      </form>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Organization</th><th>Slug</th><th className="num">Devices</th><th className="num">Users</th><th>Created</th><th>Status</th></tr></thead>
          <tbody>
            {tenants.data?.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td className="mono">{t.slug}</td>
                <td className="num">{t.devices}</td>
                <td className="num">{t.users}</td>
                <td>{fmtDate(t.created_at)}</td>
                <td>
                  <label className="check">
                    <input type="checkbox" checked={t.is_active}
                           onChange={(e) => run(() => api(`/api/platform/tenants/${t.id}`, { method: "PATCH", body: { is_active: e.target.checked } }))} />
                    {t.is_active ? "active" : "suspended"}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
