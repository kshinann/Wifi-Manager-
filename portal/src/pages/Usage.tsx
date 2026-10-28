import { useState } from "react";
import { download, query, type Device, type Tool, type UsageEvent } from "../api";
import { ErrorText, Modal, StatusBadge } from "../components/ui";
import { fmtDate, useApi } from "../hooks";

const PAGE = 50;

export default function Usage() {
  const [filters, setFilters] = useState({ tool_key: "", action: "", event_type: "", source: "", device_id: "",
                                           q: "", since: "" });
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<UsageEvent | null>(null);
  const params = { ...filters, since: filters.since ? new Date(filters.since).toISOString() : "" };
  const { data, error, loading } = useApi<{ total: number; items: UsageEvent[] }>(
    `/api/usage/events${query({ ...params, limit: PAGE, offset })}`);
  const { data: tools } = useApi<Tool[]>("/api/tools");
  const { data: devices } = useApi<Device[]>("/api/devices?include_revoked=true");
  const toolName = (key: string) => tools?.find((t) => t.key === key)?.name || key;
  const host = (id: string) => devices?.find((d) => d.id === id)?.hostname || id.slice(0, 8);

  const set = (k: keyof typeof filters) => (e: { target: { value: string } }) => {
    setFilters({ ...filters, [k]: e.target.value });
    setOffset(0);
  };

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Usage log</h1>
        <button onClick={() => download(`/api/usage/events.csv${query(params)}`, "ai-usage.csv")}>Export CSV</button>
      </div>
      <div className="card form-grid">
        <label className="field">Search<input placeholder="domain, app, user…" value={filters.q} onChange={set("q")} /></label>
        <label className="field">Tool
          <select value={filters.tool_key} onChange={set("tool_key")}>
            <option value="">All tools</option>
            {tools?.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </label>
        <label className="field">Device
          <select value={filters.device_id} onChange={set("device_id")}>
            <option value="">All devices</option>
            {devices?.map((d) => <option key={d.id} value={d.id}>{d.hostname}</option>)}
          </select>
        </label>
        <label className="field">Outcome
          <select value={filters.action} onChange={set("action")}>
            <option value="">Any</option><option value="allowed">Allowed</option>
            <option value="warned">Warned</option><option value="blocked">Blocked</option>
          </select>
        </label>
        <label className="field">Event
          <select value={filters.event_type} onChange={set("event_type")}>
            <option value="">Any</option><option value="visit">Visit</option><option value="session">Session</option>
            <option value="prompt">Prompt</option><option value="dlp">Sensitive data</option>
            <option value="blocked">Blocked</option><option value="warned">Warned</option>
          </select>
        </label>
        <label className="field">Source
          <select value={filters.source} onChange={set("source")}>
            <option value="">Any</option><option value="browser">Browser</option>
            <option value="process">Desktop app</option><option value="network">Network</option>
          </select>
        </label>
        <label className="field">Since<input type="datetime-local" value={filters.since} onChange={set("since")} /></label>
      </div>
      <ErrorText error={error} />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Time</th><th>Device / user</th><th>Tool</th><th>Event</th><th>Outcome</th><th>Detail</th>
                <th className="num">Duration</th></tr>
          </thead>
          <tbody>
            {data?.items.map((e) => (
              <tr key={e.id} className="clickable" onClick={() => setSelected(e)}>
                <td>{fmtDate(e.occurred_at)}</td>
                <td>{host(e.device_id)}<div className="subtle">{e.os_user}</div></td>
                <td>{toolName(e.tool_key)}<div className="subtle">{e.source}</div></td>
                <td>{e.event_type}</td>
                <td><StatusBadge value={e.action} /></td>
                <td>
                  {e.domain || e.process_name}
                  {e.dlp_hits.length > 0 && <div className="subtle">{e.dlp_hits.join(", ")}</div>}
                  {e.prompt_chars !== null && <div className="subtle">{e.prompt_chars} chars{e.prompt_text ? " · recorded" : ""}</div>}
                </td>
                <td className="num">{e.duration_seconds ? `${Math.round(e.duration_seconds / 60)} min` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.items.length === 0 && <p className="subtle">No events match these filters.</p>}
        <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <span className="subtle">{loading ? "Loading…" : data ? `${data.total} events` : ""}</span>
          <div className="row">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
            <button disabled={!data || offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</button>
          </div>
        </div>
      </div>
      {selected && (
        <Modal title="Event detail" onClose={() => setSelected(null)}>
          <table>
            <tbody>
              {([
                ["Time", fmtDate(selected.occurred_at)], ["Device", host(selected.device_id)], ["User", selected.os_user],
                ["Tool", toolName(selected.tool_key)], ["Source", selected.source], ["Event", selected.event_type],
                ["Outcome", selected.action], ["Reason", selected.reason], ["Domain", selected.domain],
                ["URL", selected.url], ["Process", selected.process_name],
                ["Sensitive data", selected.dlp_hits.join(", ")],
                ["Prompt length", selected.prompt_chars === null ? "" : `${selected.prompt_chars} characters`],
              ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                <tr key={k}><th style={{ width: 140 }}>{k}</th><td style={{ overflowWrap: "anywhere" }}>{v}</td></tr>
              ))}
            </tbody>
          </table>
          {selected.prompt_text !== null && (
            <>
              <h3>Recorded prompt</h3>
              <pre className="secret mono" style={{ whiteSpace: "pre-wrap" }}>{selected.prompt_text}</pre>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
