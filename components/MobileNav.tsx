'use client'

import { CloudSun, Navigation, Settings, Loader2, UserRound, LogOut } from 'lucide-react'
import { MobileInstallButton } from '@/components/PWAProvider'
import type { User } from 'firebase/auth'

interface MobileNavProps {
  onUseCurrentLocation?: () => void
  isLocating?: boolean
  user?: User | null
  authLoading?: boolean
  onOpenAuth?: () => void
  onSignOut?: () => void
  onOpenSettings?: () => void
}

export function MobileNav({
  onUseCurrentLocation,
  isLocating = false,
  user = null,
  authLoading = false,
  onOpenAuth,
  onSignOut,
  onOpenSettings,
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
        <MobileInstallButton />
        <button
          type="button"
          className="mobile-location"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          aria-label="Use current location"
          style={{ cursor: isLocating ? 'wait' : 'pointer' }}
        >
          {isLocating ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
        </button>

        {authLoading ? (
          <button
            type="button"
            className="mobile-account"
            aria-label="Loading account"
            disabled
            style={{ opacity: 0.7 }}
          >
            <Loader2 size={18} className="animate-spin" />
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
            <LogOut size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="mobile-account"
            onClick={onOpenAuth}
            aria-label="Sign in"
            title="Sign in to save locations"
          >
            <UserRound size={18} />
          </button>
        )}

        <button
          type="button"
          className="mobile-menu"
          aria-label="Settings"
          onClick={onOpenSettings}
          title="Open settings & preferences"
        >
          <Settings size={18} />
        </button>
      </div>
    </nav>
  )
}
