const TIPS = [
  {
    title: 'Use WPA3 if your router and devices support it',
    body: 'WPA3-SAE resists offline dictionary attacks even if your passphrase isn\'t perfect. Fall back to WPA2-only (never WEP) if any device can\'t support WPA3.',
  },
  {
    title: 'Pick a long, unique passphrase',
    body: 'Length beats complexity. A random passphrase of 4-6 unrelated words (or 16+ random characters) is far stronger than a short password with substitutions like "P@ssw0rd1".',
  },
  {
    title: 'Change default router credentials',
    body: 'Default admin usernames/passwords for the router\'s management page are publicly documented per model — change them immediately after setup.',
  },
  {
    title: 'Disable WPS',
    body: 'Wi-Fi Protected Setup\'s PIN method has well-known brute-force weaknesses. Turn it off in your router settings.',
  },
  {
    title: 'Keep firmware updated',
    body: 'Router vendors patch real vulnerabilities. Enable automatic updates if available, or check manually every few months.',
  },
  {
    title: 'Segment guest and IoT devices',
    body: 'Put guests and smart-home devices on a separate guest network/VLAN so a compromised device can\'t reach your main devices.',
  },
]

export function Tips() {
  return (
    <div className="page">
      <header className="page__header">
        <h1>Defend Your Network</h1>
        <p className="page__subtitle">Practical steps to protect a network you own or manage.</p>
      </header>

      {TIPS.map((tip) => (
        <div key={tip.title} className="card">
          <h3>{tip.title}</h3>
          <p>{tip.body}</p>
        </div>
      ))}

      <div className="card card--muted">
        <h2>A note on real security testing</h2>
        <p>
          Tools like aircrack-ng, hashcat, and hcxtools are legitimate parts of professional
          penetration testing — but only against networks you own or are explicitly authorized to
          test in writing. Unauthorized access to a network you don't control is illegal in most
          jurisdictions, regardless of the tool used.
        </p>
      </div>
    </div>
  )
}
