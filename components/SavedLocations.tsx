'use client'

import { AlertTriangle, Bookmark, Loader2, MapPin, Trash2, UserRound } from 'lucide-react'
import type { User } from 'firebase/auth'
import type { SelectedLocation } from '@/lib/types'
import {
  locationIdFor,
  useSavedLocations,
  type SavedLocationRecord,
} from '@/lib/useSavedLocations'

export { locationIdFor, type SavedLocationRecord }

interface SavedLocationsProps {
  user: User | null
  authLoading: boolean
  currentLocation: SelectedLocation
  onSelectLocation: (location: SelectedLocation) => void
  onOpenAuth?: () => void
  savedState?: ReturnType<typeof useSavedLocations>
}

export function SavedLocations({
  user,
  authLoading,
  currentLocation,
  onSelectLocation,
  onOpenAuth,
  savedState: externalState,
}: SavedLocationsProps) {
  // If parent didn't pass savedState, instantiate own hook
  const internalState = useSavedLocations(externalState ? null : user)
  const {
    locations,
    loading,
    saving,
    removingId,
    error,
    isLocationSaved,
    saveLocation,
    removeLocation,
  } = externalState || internalState

  const isCurrentSaved = isLocationSaved(currentLocation.latitude, currentLocation.longitude)

  if (authLoading) {
    return (
      <section className="saved-locations" aria-label="Saved locations">
        <div className="saved-locations-status">
          <Loader2 size={14} className="animate-spin" />
          <span>RESTORING SAVED LOCATIONS...</span>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section className="saved-locations saved-locations-signed-out" aria-label="Saved locations">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bookmark size={15} />
            <span>SIGN IN TO SAVE LOCATIONS ACROSS DEVICES.</span>
          </div>
          {onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="account-sign-in"
              style={{
                height: '32px',
                minHeight: '32px',
                padding: '0 12px',
                fontSize: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '2px 2px 0 var(--ink)',
              }}
            >
              <UserRound size={13} />
              <span>SIGN IN</span>
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="saved-locations" aria-label="Saved locations">
      <div className="saved-locations-heading">
        <span>
          <Bookmark size={15} /> SAVED LOCATIONS
        </span>
        <button
          type="button"
          onClick={() => saveLocation(currentLocation)}
          disabled={saving || isCurrentSaved}
          title={isCurrentSaved ? 'Current location is already saved' : 'Save current location'}
        >
          {saving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Bookmark size={13} fill={isCurrentSaved ? 'currentColor' : 'none'} />
          )}
          {isCurrentSaved ? 'SAVED' : 'SAVE CURRENT'}
        </button>
      </div>

      {error && (
        <div className="saved-locations-error">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="saved-locations-status">
          <Loader2 size={14} className="animate-spin" />
          <span>LOADING YOUR LOCATIONS...</span>
        </div>
      ) : locations.length === 0 ? (
        <div className="saved-locations-status">
          NO SAVED LOCATIONS YET. SAVE THE CURRENT CITY TO RETURN TO IT QUICKLY.
        </div>
      ) : (
        <div className="saved-locations-list">
          {locations.map((location) => (
            <div className="saved-location" key={location.id}>
              <button
                type="button"
                className="saved-location-select"
                onClick={() => {
                  const { id: _id, ...selectedLocation } = location
                  onSelectLocation({
                    ...selectedLocation,
                    timezone: 'auto',
                    source: 'SEARCH',
                  })
                }}
                title={`Load weather for ${location.name}`}
              >
                <MapPin size={14} />
                <span>
                  <b>{location.name}</b>
                  <small>{[location.admin1, location.country].filter(Boolean).join(', ')}</small>
                </span>
              </button>
              <button
                type="button"
                className="saved-location-remove"
                onClick={() => removeLocation(location.id)}
                disabled={removingId === location.id}
                aria-label={`Remove ${location.name}`}
                title={`Remove ${location.name}`}
              >
                {removingId === location.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
