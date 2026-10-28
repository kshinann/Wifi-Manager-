import { useEffect, useState } from "react";
import { api, type Tenant } from "../api";
import { useCan } from "../auth";
import { ErrorText } from "../components/ui";
import { useApi } from "../hooks";

export default function Settings() {
  const isOwner = useCan("owner");
  const tenant = useApi<Tenant>("/api/tenant");
  const [form, setForm] = useState({ name: "", event_retention_days: 365 });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (tenant.data) setForm({ name: tenant.data.name, event_retention_days: tenant.data.event_retention_days });
  }, [tenant.data]);

  async function save() {
    setError(null);
    setSaved(false);
    try {
      tenant.setData(await api<Tenant>("/api/tenant", { method: "PATCH", body: form }));
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <div className="page-head"><h1>Organization settings</h1></div>
      <div className="card stack">
        <fieldset disabled={!isOwner} style={{ border: 0, padding: 0, margin: 0 }} className="form-grid">
          <label className="field">Organization name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">Keep usage events for (days)
            <input type="number" min={7} max={3650} value={form.event_retention_days}
                   onChange={(e) => setForm({ ...form, event_retention_days: Number(e.target.value) })} /></label>
        </fieldset>
        <p className="subtle">Recorded prompt text has its own, shorter retention set in each policy.</p>
        <ErrorText error={error || tenant.error} />
        {isOwner && (
          <div className="row">
            <button className="primary" onClick={save}>Save</button>
            {saved && <span className="badge good">✓ saved</span>}
          </div>
        )}
        {tenant.data && <p className="subtle mono">Tenant ID: {tenant.data.id}</p>}
      </div>
    </div>
  );
}
