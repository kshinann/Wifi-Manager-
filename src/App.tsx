import { useState } from 'react'
import { Learn } from './pages/Learn'
import { Scanner } from './pages/Scanner'
import { Handshake } from './pages/Handshake'
import { Cracking } from './pages/Cracking'
import { Tips } from './pages/Tips'

const TABS = [
  { key: 'learn', label: 'Learn', icon: '📘', Component: Learn },
  { key: 'scan', label: 'Scan Demo', icon: '📶', Component: Scanner },
  { key: 'handshake', label: 'Handshake', icon: '🤝', Component: Handshake },
  { key: 'crack', label: 'Crack Demo', icon: '🔓', Component: Cracking },
  { key: 'tips', label: 'Defend', icon: '🛡️', Component: Tips },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function App() {
  const [active, setActive] = useState<TabKey>('learn')
  const ActiveComponent = TABS.find((t) => t.key === active)!.Component

  return (
    <div className="app">
      <main className="app__content">
        <ActiveComponent />
      </main>
      <nav className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-bar__item ${active === tab.key ? 'tab-bar__item--active' : ''}`}
            onClick={() => setActive(tab.key)}
          >
            <span className="tab-bar__icon" aria-hidden>
              {tab.icon}
            </span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
