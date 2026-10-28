import { useState } from "react";
import { api, type Tool } from "../api";
import { useCan } from "../auth";
import { ErrorText, Modal } from "../components/ui";
import { useApi } from "../hooks";

const EMPTY = { key: "", name: "", vendor: "", category: "chat", domains: "", windows: "", macos: "" };

export default function Tools() {
  const isAdmin = useCan("admin");
  const tools = useApi<Tool[]>("/api/tools");
  const [form, setForm] = useState<typeof EMPTY & { id?: number }>(EMPTY);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

  function edit(t: Tool) {
    setForm({ id: t.id, key: t.key, name: t.name, vendor: t.vendor, category: t.category, domains: t.domains.join("\n"),
              windows: (t.processes.windows || []).join("\n"), macos: (t.processes.macos || []).join("\n") });
    setOpen(true);
  }

  async function save() {
    setError(null);
    const body = { key: form.key, name: form.name, vendor: form.vendor, category: form.category, domains: lines(form.domains),
                   processes: { windows: lines(form.windows), macos: lines(form.macos) } };
    try {
      if (form.id) await api(`/api/tools/${form.id}`, { method: "PUT", body });
      else await api("/api/tools", { method: "POST", body });
      setOpen(false);
      tools.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h1>AI tools catalog</h1>
        {isAdmin && <button className="primary" onClick={() => { setForm(EMPTY); setOpen(true); }}>Add tool</button>}
      </div>
      <p className="subtle">
        The agent recognizes these tools by website domain and desktop app name. Built-in entries are updated with each
        release; add your own for internal or niche AI tools.
      </p>
      <ErrorText error={tools.error} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Tool</th><th>Category</th><th>Domains</th><th>Desktop apps</th><th /></tr></thead>
          <tbody>
            {tools.data?.map((t) => (
              <tr key={t.id}>
                <td>{t.name}<div className="subtle">{t.vendor}{t.builtin ? "" : " · custom"}</div></td>
                <td>{t.category}</td>
                <td className="mono">{t.domains.join(", ")}</td>
                <td className="mono">{[...(t.processes.windows || []), ...(t.processes.macos || [])].join(", ")}</td>
                <td>{isAdmin && !t.builtin && (
                  <div className="row">
                    <button className="link" onClick={() => edit(t)}>Edit</button>
                    <button className="link danger" onClick={async () => {
                      if (confirm(`Delete ${t.name}?`)) { await api(`/api/tools/${t.id}`, { method: "DELETE" }); tools.reload(); }
                    }}>Delete</button>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title={form.id ? `Edit ${form.name}` : "Add AI tool"} onClose={() => setOpen(false)}>
          <div className="form-grid">
            <label className="field">Key (a-z, 0-9, _)<input value={form.key} disabled={!!form.id}
              onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })} /></label>
            <label className="field">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field">Vendor<input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></label>
            <label className="field">Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["chat", "coding", "image", "search", "api", "local", "other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="field">Domains (one per line; subdomains included)<textarea value={form.domains}
            onChange={(e) => setForm({ ...form, domains: e.target.value })} /></label>
          <div className="form-grid">
            <label className="field">Windows process names<textarea placeholder="App.exe" value={form.windows}
              onChange={(e) => setForm({ ...form, windows: e.target.value })} /></label>
            <label className="field">macOS process names<textarea placeholder="App" value={form.macos}
              onChange={(e) => setForm({ ...form, macos: e.target.value })} /></label>
          </div>
          <ErrorText error={error} />
          <div className="row" style={{ marginTop: 16 }}><button className="primary" onClick={save}>Save</button></div>
        </Modal>
      )}
    </div>
  );
}
