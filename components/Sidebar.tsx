'use client'

import { useState } from 'react'
import { Grid2X2, MapPin, Bell, Activity, Settings, CloudSun } from 'lucide-react'

const NAV_ITEMS: { Icon: typeof Grid2X2; id: string }[] = [
  { Icon: Grid2X2, id: 'dashboard' },
  { Icon: MapPin, id: 'places' },
  { Icon: Bell, id: 'alerts' },
  { Icon: Activity, id: 'insights' },
]

export function Sidebar() {
  const [activeNav, setActiveNav] = useState('dashboard')

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="brand-mark">
          <CloudSun size={22} />
        </span>
        <span>WI</span>
      </div>
      <nav aria-label="Main navigation">
        {NAV_ITEMS.map(({ Icon, id }) => (
          <button
            key={id}
            className={`nav-item ${activeNav === id ? 'active' : ''}`}
            onClick={() => setActiveNav(id)}
            aria-label={id}
          >
            <Icon size={19} />
          </button>
        ))}
      </nav>
      <button className="nav-item bottom" aria-label="Settings">
        <Settings size={19} />
      </button>
    </aside>
  )
}
