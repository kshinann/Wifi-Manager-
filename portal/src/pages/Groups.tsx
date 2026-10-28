import { useState } from "react";
import { api, type Group, type Policy } from "../api";
import { useCan } from "../auth";
import { ErrorText } from "../components/ui";
import { useApi } from "../hooks";

export default function Groups() {
  const isAdmin = useCan("admin");
  const groups = useApi<Group[]>("/api/groups");
  const policies = useApi<Policy[]>("/api/policies");
  const [form, setForm] = useState({ name: "", description: "", policy_id: "" });
  const [error, setError] = useState<string | null>(null);
  const defaultPolicy = policies.data?.find((p) => p.is_default);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      groups.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <div className="page-head"><h1>Groups</h1></div>
      <p className="subtle">
        Groups apply a policy to a set of devices (for example a department). Devices without a group, or in a group
        without a policy, use the default policy{defaultPolicy ? ` (“${defaultPolicy.name}”)` : ""}.
      </p>
      <ErrorText error={error || groups.error} />
      {isAdmin && (
        <form className="card form-grid" onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/api/groups", { method: "POST", body: { ...form, policy_id: form.policy_id || null } });
            setForm({ name: "", description: "", policy_id: "" });
          });
        }}>
          <label className="field">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field">Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="field">Policy
            <select value={form.policy_id} onChange={(e) => setForm({ ...form, policy_id: e.target.value })}>
              <option value="">Default policy</option>
              {policies.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="row" style={{ alignItems: "end" }}><button className="primary">Add group</button></div>
        </form>
      )}
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Policy</th><th className="num">Devices</th><th /></tr></thead>
          <tbody>
            {groups.data?.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>{g.description}</td>
                <td>
                  {isAdmin ? (
                    <select value={g.policy_id || ""} aria-label={`Policy for ${g.name}`}
                            onChange={(e) => run(() => api(`/api/groups/${g.id}`, { method: "PATCH", body: { policy_id: e.target.value || null } }))}>
                      <option value="">Default policy</option>
                      {policies.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  ) : policies.data?.find((p) => p.id === g.policy_id)?.name || "Default policy"}
                </td>
                <td className="num">{g.device_count}</td>
                <td>{isAdmin && (
                  <button className="link danger" onClick={() => {
                    if (confirm(`Delete group ${g.name}? Its devices move to the default policy.`)) {
                      run(() => api(`/api/groups/${g.id}`, { method: "DELETE" }));
                    }
                  }}>Delete</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {groups.data?.length === 0 && <p className="subtle">No groups yet.</p>}
      </div>
    </div>
  );
}
