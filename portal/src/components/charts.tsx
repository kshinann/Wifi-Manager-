import { useState } from "react";

interface Point {
  label: string;
  value: number;
  detail?: string;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

/** Single-series column chart over time with a hover tooltip and a table view. */
export function ColumnChart({ data, unit, title }: { data: Point[]; unit: string; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const W = 640, H = 200, padL = 40, padB = 22, padT = 8;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const plotW = W - padL, plotH = H - padB - padT;
  const slot = data.length ? plotW / data.length : plotW;
  const barW = Math.max(2, Math.min(28, slot - 2));
  const ticks = [0, max / 2, max];
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className="chart">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{title}</h2>
        <button className="link view-toggle" onClick={() => setAsTable(!asTable)}>
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {data.length === 0 ? (
        <p className="subtle">No usage recorded in this period.</p>
      ) : asTable ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th className="num">{unit}</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td className="num">{d.value}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, ${data.length} days`}>
            {ticks.map((t) => {
              const y = padT + plotH - (t / max) * plotH;
              return (
                <g key={t}>
                  <line className="gridline" x1={padL} x2={W} y1={y} y2={y} />
                  <text className="axis-label" x={padL - 6} y={y + 4} textAnchor="end">{Math.round(t)}</text>
                </g>
              );
            })}
            {data.map((d, i) => {
              const h = (d.value / max) * plotH;
              const x = padL + i * slot + (slot - barW) / 2;
              const y = padT + plotH - h;
              const r = Math.min(4, barW / 2, h);
              // Rounded top, square baseline.
              const path = h <= 0 ? "" :
                `M${x},${padT + plotH} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${padT + plotH} Z`;
              return (
                <g key={d.label} className="col" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect className="hit" x={padL + i * slot} y={padT} width={slot} height={plotH} />
                  {path && <path className="bar" d={path} />}
                  {i % labelEvery === 0 && (
                    <text className="axis-label" x={x + barW / 2} y={H - 6} textAnchor="middle">{d.label.slice(5)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div className="tooltip" style={{
              left: `${((padL + hover * slot + slot / 2) / W) * 100}%`,
              top: `${((padT + plotH - (data[hover].value / max) * plotH) / H) * 100}%`,
            }}>
              <strong>{data[hover].label}</strong> · {data[hover].value} {unit}
              {data[hover].detail && <> · {data[hover].detail}</>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Ranked horizontal bars with direct value labels (doubles as its own table view). */
export function RankBars({ rows, title, empty }: { rows: { label: string; value: number; text: string }[]; title: string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="subtle">{empty || "Nothing recorded yet."}</p>
      ) : (
        <div className="rank" role="table" aria-label={title}>
          {rows.map((r) => (
            <div key={r.label} role="row" style={{ display: "contents" }}>
              <span role="cell" title={r.label} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
              <span className="track" aria-hidden="true"><span className="fill" style={{ display: "block", width: `${(r.value / max) * 100}%` }} /></span>
              <span role="cell" className="val">{r.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
