import { useEffect, useRef, useState } from 'react'
import { SAMPLE_WORDLIST, SAMPLE_TARGET_PASSPHRASE, STRONG_PASSPHRASE_EXAMPLE } from '../data/wordlist'
import { SimBanner } from '../components/SimBanner'

type Target = 'WPA2-PSK' | 'WPA3-SAE'
type Status = 'idle' | 'running' | 'found' | 'immune'

const STEP_DELAY_MS = 350

export function Cracking() {
  const [target, setTarget] = useState<Target>('WPA2-PSK')
  const [status, setStatus] = useState<Status>('idle')
  const [tried, setTried] = useState<string[]>([])
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  function reset() {
    if (timerRef.current) window.clearInterval(timerRef.current)
    setTried([])
    setStatus('idle')
  }

  function start() {
    reset()
    if (target === 'WPA3-SAE') {
      setStatus('immune')
      return
    }
    setStatus('running')
    let i = 0
    timerRef.current = window.setInterval(() => {
      i += 1
      const candidate = SAMPLE_WORDLIST[i - 1]
      setTried((prev) => [...prev, candidate])
      const isMatch = candidate === SAMPLE_TARGET_PASSPHRASE
      if (isMatch || i >= SAMPLE_WORDLIST.length) {
        if (timerRef.current) window.clearInterval(timerRef.current)
        setStatus(isMatch ? 'found' : 'idle')
      }
    }, STEP_DELAY_MS)
  }

  const progressPct = Math.round((tried.length / SAMPLE_WORDLIST.length) * 100)

  return (
    <div className="page">
      <header className="page__header">
        <h1>Crack Demo</h1>
        <p className="page__subtitle">
          Simulates an offline dictionary attack against a captured handshake's integrity code —
          against a small, fixed sample wordlist only.
        </p>
      </header>

      <SimBanner />

      <div className="card">
        <h2>Choose a sample target</h2>
        <div className="segmented">
          <button
            className={`segmented__btn ${target === 'WPA2-PSK' ? 'segmented__btn--active' : ''}`}
            onClick={() => {
              setTarget('WPA2-PSK')
              reset()
            }}
          >
            WPA2-PSK (weak passphrase)
          </button>
          <button
            className={`segmented__btn ${target === 'WPA3-SAE' ? 'segmented__btn--active' : ''}`}
            onClick={() => {
              setTarget('WPA3-SAE')
              reset()
            }}
          >
            WPA3-SAE
          </button>
        </div>
        <button className="btn" onClick={start} disabled={status === 'running'}>
          {status === 'running' ? 'Running…' : 'Run simulated attack'}
        </button>
      </div>

      {status === 'immune' && (
        <div className="card card--muted">
          <h2>No offline attack possible</h2>
          <p>
            WPA3-SAE's key exchange means an attacker can't just capture a message and try
            passphrases against it offline — each guess requires interacting with the live access
            point, which can detect and throttle repeated failures. There's nothing to simulate
            here because this class of attack doesn't apply.
          </p>
        </div>
      )}

      {status !== 'idle' && status !== 'immune' && (
        <div className="card">
          <h2>Dictionary attack progress</h2>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="crack-log__stats">
            {tried.length} / {SAMPLE_WORDLIST.length} candidates tried
          </p>
          <ul className="crack-log">
            {tried.map((word, idx) => {
              const isLast = idx === tried.length - 1
              const matched = word === SAMPLE_TARGET_PASSPHRASE
              return (
                <li key={idx} className={matched ? 'crack-log__row--match' : ''}>
                  <code>{word}</code>
                  <span>{matched ? '✓ MIC matches' : isLast && status === 'running' ? '…' : '✗'}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {status === 'found' && (
        <div className="card card--muted">
          <h2>Passphrase recovered (simulated)</h2>
          <p>
            The sample passphrase <code>{SAMPLE_TARGET_PASSPHRASE}</code> was in a small,
            13-word list and was found almost instantly. Real dictionary/rule-based attacks use
            lists with billions of entries and can still succeed against common or short
            passphrases in minutes. A passphrase like <code>{STRONG_PASSPHRASE_EXAMPLE}</code>{' '}
            resists this entirely — it isn't in any wordlist and is too long to brute-force.
          </p>
        </div>
      )}
    </div>
  )
}
