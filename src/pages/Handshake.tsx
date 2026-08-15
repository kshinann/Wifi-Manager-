import { useState } from 'react'
import { HANDSHAKE_STEPS, HANDSHAKE_TAKEAWAY } from '../data/handshake'
import { SimBanner } from '../components/SimBanner'

export function Handshake() {
  const [visible, setVisible] = useState(1)

  const atEnd = visible >= HANDSHAKE_STEPS.length

  return (
    <div className="page">
      <header className="page__header">
        <h1>Handshake Demo</h1>
        <p className="page__subtitle">
          Step through the WPA/WPA2 4-way handshake with an illustrative sample exchange.
        </p>
      </header>

      <SimBanner />

      <div className="handshake-diagram">
        <div className="handshake-diagram__col">
          <span className="handshake-diagram__label">Access Point</span>
        </div>
        <div className="handshake-diagram__col">
          <span className="handshake-diagram__label">Client</span>
        </div>
      </div>

      <div className="handshake-steps">
        {HANDSHAKE_STEPS.slice(0, visible).map((s) => (
          <div key={s.step} className="card handshake-step">
            <div className="card__row">
              <h3>
                Step {s.step} · {s.message}
              </h3>
              <span className="handshake-step__arrow">
                {s.from === 'AP' ? 'AP → Client' : 'Client → AP'}
              </span>
            </div>
            <code className="handshake-step__payload">{s.payload}</code>
            <p>{s.explanation}</p>
          </div>
        ))}
      </div>

      {!atEnd ? (
        <button className="btn" onClick={() => setVisible((v) => Math.min(v + 1, HANDSHAKE_STEPS.length))}>
          Show next message
        </button>
      ) : (
        <div className="card card--muted">
          <h2>Why this matters</h2>
          <p>{HANDSHAKE_TAKEAWAY}</p>
          <button className="btn btn--ghost" onClick={() => setVisible(1)}>
            Replay
          </button>
        </div>
      )}
    </div>
  )
}
