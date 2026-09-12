'use client'

import { CloudSun, Navigation, Settings, Loader2, UserRound, LogOut } from 'lucide-react'
import type { User } from 'firebase/auth'

interface MobileNavProps {
  onUseCurrentLocation?: () => void
  isLocating?: boolean
  user?: User | null
  authLoading?: boolean
  onOpenAuth?: () => void
  onSignOut?: () => void
}

export function MobileNav({
  onUseCurrentLocation,
  isLocating = false,
  user = null,
  authLoading = false,
  onOpenAuth,
  onSignOut,
}: MobileNavProps) {
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
          type="button"
          className="mobile-location"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          aria-label="Use current location"
          style={{ cursor: isLocating ? 'wait' : 'pointer' }}
        >
          {isLocating ? <Loader2 size={17} className="animate-spin" /> : <Navigation size={17} />}
        </button>

        {authLoading ? (
          <button
            type="button"
            className="mobile-account"
            aria-label="Loading account"
            disabled
            style={{ opacity: 0.7 }}
          >
            <Loader2 size={17} className="animate-spin" />
          </button>
        ) : user ? (
          <button
            type="button"
            className="mobile-account signed-in"
            onClick={onSignOut}
            aria-label={`Sign out ${user.displayName || user.email || 'account'}`}
            title={`Signed in as ${user.displayName || user.email}. Tap to sign out.`}
            style={{ background: 'var(--lavender)' }}
          >
            <LogOut size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="mobile-account"
            onClick={onOpenAuth}
            aria-label="Sign in"
            title="Sign in to save locations"
          >
            <UserRound size={17} />
          </button>
        )}

        <button
          type="button"
          className="mobile-menu"
          aria-label="Account / settings"
          onClick={user ? onSignOut : onOpenAuth}
          title={user ? `Signed in: ${user.email}. Tap to sign out.` : 'Sign in / Settings'}
        >
          <Settings size={17} />
        </button>
      </div>
    </nav>
  )
}
