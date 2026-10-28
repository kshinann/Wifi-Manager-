import { useState } from "react";
import { Link } from "react-router-dom";
import type { Summary, Tool } from "../api";
import { ColumnChart, RankBars } from "../components/charts";
import { ErrorText, StatTile } from "../components/ui";
import { fmtMinutes, fmtNumber, useApi } from "../hooks";

const RANGES = [1, 7, 30, 90];

export default function Dashboard() {
  const [days, setDays] = useState(7);
  const { data, error } = useApi<Summary>(`/api/usage/summary?days=${days}`);
  const { data: tools } = useApi<Tool[]>("/api/tools");
  const toolName = (key: string) => tools?.find((t) => t.key === key)?.name || key;

  return (
    <div className="stack">
      <div className="page-head">
        <h1>AI usage overview</h1>
        <div className="row" role="group" aria-label="Time range">
          {RANGES.map((d) => (
            <button key={d} className={d === days ? "primary" : ""} onClick={() => setDays(d)}>
              {d === 1 ? "24 h" : `${d} days`}
            </button>
          ))}
        </div>
      </div>
      <ErrorText error={error} />
      {data && (
        <>
          <div className="grid tiles">
            <StatTile label="Time in AI tools" value={fmtMinutes(data.totals.minutes)} />
            <StatTile label="Active devices" value={fmtNumber(data.totals.active_devices)} />
            <StatTile label="Prompts" value={fmtNumber(data.totals.prompts)} />
            <StatTile label="Blocked" value={fmtNumber(data.totals.blocked)} hint="visits, apps and prompts" />
            <StatTile label="Sensitive data hits" value={fmtNumber(data.totals.dlp_hits)} />
          </div>
          <div className="card">
            <ColumnChart
              title="Minutes in AI tools per day"
              unit="min"
              data={data.by_day.map((d) => ({ label: d.date, value: d.minutes,
                                              detail: `${d.events} events, ${d.blocked} blocked` }))}
            />
          </div>
          <div className="grid two">
            <div className="card">
              <RankBars title="Most used tools" rows={data.by_tool.slice(0, 10).map((t) => ({
                label: toolName(t.tool_key), value: t.minutes,
                text: `${fmtMinutes(t.minutes)} · ${t.devices} PCs${t.blocked ? ` · ${t.blocked} blocked` : ""}`,
              }))} />
            </div>
            <div className="card">
              <RankBars title="Top devices" rows={data.top_devices.map((d) => ({
                label: d.hostname, value: d.minutes, text: `${fmtMinutes(d.minutes)} · ${d.events} events`,
              }))} />
            </div>
            <div className="card">
              <RankBars title="Top users" rows={data.top_users.map((u) => ({
                label: u.os_user, value: u.minutes, text: `${fmtMinutes(u.minutes)} · ${u.events} events`,
              }))} />
            </div>
            <div className="card">
              <RankBars title="Detected by" rows={data.by_source.map((s) => ({
                label: { browser: "Browser extension", process: "Desktop app", network: "Network traffic" }[s.source] || s.source,
                value: s.events, text: `${fmtNumber(s.events)} events`,
              }))} />
            </div>
          </div>
          {data.totals.events === 0 && (
            <div className="notice">
              No usage yet. <Link to="/devices">Enroll a device</Link> to start collecting data.
            </div>
          )}
        </>
      )}
    </div>
  );
}
