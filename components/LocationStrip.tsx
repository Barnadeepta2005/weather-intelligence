'use client'

import { MapPin, Heart, Loader2, Share2 } from 'lucide-react'
import type { LocationData } from '@/lib/types'

interface LocationStripProps {
  location: LocationData
  isLive?: boolean
  isSaved?: boolean
  onToggleSave?: () => void
  isSaving?: boolean
  isAuthenticated?: boolean
  onOpenAuth?: () => void
  onOpenShare?: () => void
}

export function LocationStrip({
  location,
  isLive = true,
  isSaved = false,
  onToggleSave,
  isSaving = false,
  isAuthenticated = false,
  onOpenAuth,
  onOpenShare,
}: LocationStripProps) {
  const adminSuffix =
    location.admin1 && location.admin1.toUpperCase() !== location.city.toUpperCase()
      ? `, ${location.admin1.toUpperCase()}`
      : ''

  const handleSaveClick = () => {
    if (isSaving) return
    if (!isAuthenticated && onOpenAuth) {
      onOpenAuth()
      return
    }
    if (onToggleSave) {
      onToggleSave()
    }
  }

  return (
    <div className="location-strip">
      <div className="location-strip-main">
        {/* Primary Row: [Status Dot] ~16-24px [Pin] ~32-48px [Location Text] */}
        <div className="location-primary-row">
          <div className="location-control-cluster">
            <span
              className="live-dot"
              style={{ backgroundColor: isLive ? '#22c55e' : '#eab308' }}
              aria-label={isLive ? 'Live data feed' : 'Demo data feed'}
            />
            <MapPin size={15} className="location-pin-icon" aria-hidden="true" />
          </div>
          <strong className="location-name-text">
            {location.city}
            {adminSuffix}, {location.country}
          </strong>
        </div>

        {/* Secondary Time Row: visually subordinate, anchored below */}
        <div className="location-secondary-row">
          <span className="updated">
            LOCAL TIME {location.localTime} / {isLive ? `UPDATED ${location.lastUpdated}` : 'DEMO MODE (OFFLINE)'}
          </span>
        </div>
      </div>

      <div className="location-strip-actions">
        {onOpenShare && (
          <button
            type="button"
            onClick={onOpenShare}
            className="share-weather-btn"
            aria-label="Share weather snapshot"
            title="Create shareable weather card"
          >
            <Share2 size={13} />
            SHARE
          </button>
        )}
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          className={`save-btn ${isSaved ? 'saved' : ''}`}
          aria-label={isSaved ? 'Remove from saved locations' : 'Save this location'}
          title={!isAuthenticated ? 'Sign in to save this location' : isSaved ? 'Click to remove from saved locations' : 'Save to your account'}
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Heart size={14} fill={isSaved ? 'currentColor' : 'none'} />
          )}
          {isSaved ? 'SAVED' : 'SAVE LOCATION'}
        </button>
      </div>
    </div>
  )
}
