import { useState } from 'react'
import { DEMO_NETWORKS, type DemoNetwork } from '../data/networks'
import { RiskBadge } from '../components/RiskBadge'
import { SimBanner } from '../components/SimBanner'

function signalBars(signal: number) {
  if (signal > -50) return 4
  if (signal > -60) return 3
  if (signal > -70) return 2
  return 1
}

export function Scanner() {
  const [selected, setSelected] = useState<DemoNetwork | null>(null)

  return (
    <div className="page">
      <header className="page__header">
        <h1>Scanner Demo</h1>
        <p className="page__subtitle">
          A fixed list of sample networks — tap one to see what its security type means.
        </p>
      </header>

      <SimBanner />

      <ul className="network-list">
        {DEMO_NETWORKS.map((net) => (
          <li key={net.id}>
            <button className="network-row" onClick={() => setSelected(net)}>
              <div className="network-row__signal" aria-hidden>
                {[1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className={`signal-bar ${bar <= signalBars(net.signal) ? 'signal-bar--on' : ''}`}
                    style={{ height: `${bar * 4 + 4}px` }}
                  />
                ))}
              </div>
              <div className="network-row__info">
                <span className="network-row__ssid">{net.ssid}</span>
                <span className="network-row__meta">
                  {net.security} · ch {net.channel} · {net.signal} dBm
                </span>
              </div>
              <RiskBadge risk={net.risk} />
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="sheet-backdrop" onClick={() => setSelected(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__handle" />
            <h2>{selected.ssid}</h2>
            <p className="sheet__meta">
              {selected.bssid} · {selected.security}
            </p>
            <RiskBadge risk={selected.risk} />
            <p className="sheet__body">{selected.details}</p>
            <button className="btn" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
