'use client'

import { CloudSun, Grid2X2, MapPin, Bell, Activity } from 'lucide-react'
import type { NavActionId } from './Sidebar'

export interface MobileBottomNavProps {
  activeNav?: NavActionId | string
  onNavigate?: (id: NavActionId) => void
  isNotificationsOpen?: boolean
}

const MOBILE_NAV_ITEMS: { id: NavActionId; label: string; Icon: typeof CloudSun }[] = [
  { id: 'home', label: 'HOME', Icon: CloudSun },
  { id: 'trends', label: 'TRENDS', Icon: Grid2X2 },
  { id: 'location', label: 'LOCATION', Icon: MapPin },
  { id: 'notifications', label: 'ALERTS', Icon: Bell },
  { id: 'intelligence', label: 'INTEL', Icon: Activity },
]

export function MobileBottomNav({
  activeNav = 'home',
  onNavigate,
  isNotificationsOpen = false,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
      <div className="mobile-bottom-nav-inner">
        {MOBILE_NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive =
            id === 'notifications'
              ? isNotificationsOpen || activeNav === 'notifications'
              : activeNav === id

          return (
            <button
              key={id}
              type="button"
              className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate?.(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="mobile-nav-icon-wrap">
                <Icon size={18} />
              </span>
              <span className="mobile-nav-label">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
