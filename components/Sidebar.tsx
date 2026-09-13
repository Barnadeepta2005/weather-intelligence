'use client'

import { Grid2X2, MapPin, Bell, Activity, CloudSun, UserRound, LogOut, Settings } from 'lucide-react'
import type { User } from 'firebase/auth'
import { AtmosWeatherMark } from '@/components/weather-icons/AtmosWeatherMark'

export type NavActionId = 'home' | 'trends' | 'location' | 'notifications' | 'intelligence'

export interface SidebarProps {
  user?: User | null
  activeNav?: string
  onNavigate?: (id: NavActionId) => void
  onOpenAuth?: () => void
  onSignOut?: () => void
  onOpenSettings?: () => void
  isSettingsOpen?: boolean
  isNotificationsOpen?: boolean
}

export function Sidebar({
  user = null,
  activeNav = 'home',
  onNavigate,
  onOpenAuth,
  onSignOut,
  onOpenSettings,
  isSettingsOpen = false,
  isNotificationsOpen = false,
}: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Desktop navigation rail">
      {/* 1. WEATHER / HOME */}
      <button
        type="button"
        className={`brand-lockup brand-btn ${activeNav === 'home' ? 'active' : ''}`}
        onClick={() => onNavigate?.('home')}
        aria-label="ATMOS WEATHER Home"
        title="Scroll to ATMOS WEATHER Dashboard"
      >
        <span className="brand-mark" style={{ padding: '2px' }}>
          <AtmosWeatherMark size={28} />
        </span>
        <span>ATMOS</span>
      </button>

      {/* PRIMARY RAIL CONTROLS */}
      <nav aria-label="Main rail navigation">
        {/* 2. GRID -> WEATHER TRENDS */}
        <button
          type="button"
          className={`nav-item ${activeNav === 'trends' ? 'active' : ''}`}
          onClick={() => onNavigate?.('trends')}
          aria-label="Weather Trends"
          title="Weather Trends & Historical Comparison"
        >
          <Grid2X2 size={19} />
        </button>

        {/* 3. LOCATION PIN -> SEARCH / GEOLOCATION */}
        <button
          type="button"
          className={`nav-item ${activeNav === 'location' ? 'active' : ''}`}
          onClick={() => onNavigate?.('location')}
          aria-label="Location Search"
          title="Search City or Use Geolocation"
        >
          <MapPin size={19} />
        </button>

        {/* 4. BELL -> NOTIFICATIONS */}
        <button
          type="button"
          className={`nav-item ${isNotificationsOpen || activeNav === 'notifications' ? 'active' : ''}`}
          onClick={() => onNavigate?.('notifications')}
          aria-label="Notifications"
          title="Weather Alerts & Push Notifications"
        >
          <Bell size={19} />
        </button>

        {/* 5. ACTIVITY / PULSE -> ADVANCED WEATHER INTELLIGENCE */}
        <button
          type="button"
          className={`nav-item ${activeNav === 'intelligence' ? 'active' : ''}`}
          onClick={() => onNavigate?.('intelligence')}
          aria-label="ATMOS WEATHER Intelligence"
          title="ATMOS WEATHER — Advanced Decision Support"
        >
          <Activity size={19} />
        </button>
      </nav>

      {/* BOTTOM CONTROLS: SETTINGS & ACCOUNT */}
      <div
        className="sidebar-bottom"
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '13px',
          alignItems: 'center',
        }}
      >
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
