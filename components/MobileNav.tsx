'use client'

import { CloudSun, Navigation, Settings, Loader2 } from 'lucide-react'

interface MobileNavProps {
  onUseCurrentLocation?: () => void
  isLocating?: boolean
}

export function MobileNav({ onUseCurrentLocation, isLocating = false }: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <div className="mobile-brand">
        <span className="brand-mark">
          <CloudSun size={18} />
        </span>
        <strong>
          WEATHER
          <br />
          INTELLIGENCE
        </strong>
      </div>
      <div className="mobile-nav-actions">
        <button
          className="mobile-location"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          aria-label="Use current location"
          style={{ cursor: isLocating ? 'wait' : 'pointer' }}
        >
          {isLocating ? <Loader2 size={17} className="animate-spin" /> : <Navigation size={17} />}
        </button>
        <button className="mobile-menu" aria-label="Open menu">
          <Settings size={17} />
        </button>
      </div>
    </nav>
  )
}
