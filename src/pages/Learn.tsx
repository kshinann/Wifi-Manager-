import { SECURITY_INFO } from '../data/networks'
import { RiskBadge } from '../components/RiskBadge'

export function Learn() {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Wi-Fi Security Academy</h1>
        <p className="page__subtitle">
          Understand how Wi-Fi encryption protocols work, and why some are safer than others — all
          with simulated examples, never a real attack.
        </p>
      </header>

      <section className="card">
        <h2>Why this app exists</h2>
        <p>
          Tools like <strong>aircrack-ng</strong> are legitimate, widely-used security research
          software — but they're built to attack real networks and require explicit authorization
          to use lawfully. This app teaches the same underlying concepts (handshakes, key
          derivation, dictionary attacks) using fictional sample data, so you can learn the "why"
          without needing a target network or breaking any laws.
        </p>
      </section>

      <section>
        <h2 className="section-title">Security protocols, from worst to best</h2>
        {(['Open', 'WEP', 'WPA2-PSK', 'WPA3-SAE'] as const).map((key) => {
          const info = SECURITY_INFO[key]
          return (
            <div key={key} className="card">
              <div className="card__row">
                <h3>{info.title}</h3>
                <RiskBadge risk={info.risk} />
              </div>
              <p>{info.description}</p>
            </div>
          )
        })}
      </section>

      <section className="card card--muted">
        <h2>What "cracking" actually means</h2>
        <p>
          For WEP, statistical weaknesses in the cipher let an attacker recover the key directly
          from captured traffic. For WPA/WPA2-Personal, the protocol is sound — attackers instead
          capture a handshake and try guessing the passphrase <em>offline</em>, checking each guess
          against the handshake's integrity code. That's why passphrase strength — not the protocol
          — is usually the weak point. Explore the <strong>Handshake</strong> and{' '}
          <strong>Crack Demo</strong> tabs to see both ideas in action.
        </p>
      </section>
    </div>
  )
}
