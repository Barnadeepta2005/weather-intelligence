'use client'

import { useState } from 'react'
import { Grid2X2, MapPin, Bell, Activity, CloudSun, UserRound, LogOut, Settings } from 'lucide-react'
import type { User } from 'firebase/auth'

const NAV_ITEMS: { Icon: typeof Grid2X2; id: string }[] = [
  { Icon: Grid2X2, id: 'dashboard' },
  { Icon: MapPin, id: 'places' },
  { Icon: Bell, id: 'alerts' },
  { Icon: Activity, id: 'insights' },
]

interface SidebarProps {
  user?: User | null
  onOpenAuth?: () => void
  onSignOut?: () => void
  onNavigatePlaces?: () => void
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
}

export function Sidebar({
  user = null,
  onOpenAuth,
  onSignOut,
  onNavigatePlaces,
  onOpenSettings,
  isSettingsOpen = false,
}: SidebarProps) {
  const [activeNav, setActiveNav] = useState('dashboard')

  const handleNavClick = (id: string) => {
    setActiveNav(id)
    if (id === 'places') {
      if (onNavigatePlaces) {
        onNavigatePlaces()
      } else {
        const savedSection = document.querySelector('.saved-locations') || document.querySelector('.places-section')
        savedSection?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

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
            type="button"
            className={`nav-item ${activeNav === id ? 'active' : ''}`}
            onClick={() => handleNavClick(id)}
            aria-label={id}
          >
            <Icon size={19} />
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '13px', alignItems: 'center' }}>
        <button
          type="button"
          className={`nav-item ${isSettingsOpen ? 'active' : ''}`}
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Preferences & Settings"
        >
          <Settings size={19} />
        </button>
        {user ? (
          <button
            type="button"
            className="nav-item"
            onClick={onSignOut}
            aria-label="Sign out"
            title={`Signed in: ${user.displayName || user.email}. Click to sign out.`}
            style={{ background: 'var(--lavender)' }}
          >
            <LogOut size={19} />
          </button>
        ) : (
          <button
            type="button"
            className="nav-item"
            onClick={onOpenAuth}
            aria-label="Sign in"
            title="Sign in to your account"
          >
            <UserRound size={19} />
          </button>
        )}
      </div>
    </aside>
  )
}
