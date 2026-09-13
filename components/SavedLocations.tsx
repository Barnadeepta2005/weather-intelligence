'use client'

import { AlertTriangle, Bookmark, Loader2, RefreshCw, Trash2, UserRound } from 'lucide-react'
import type { User } from 'firebase/auth'
import type { SelectedLocation, TemperatureUnit } from '@/lib/types'
import { WeatherIcon } from '@/components/WeatherIcon'
import {
  locationIdFor,
  useSavedLocations,
  type SavedLocationRecord,
} from '@/lib/useSavedLocations'
import { useSavedLocationsWeather } from '@/lib/useSavedLocationsWeather'

export { locationIdFor, type SavedLocationRecord }

interface SavedLocationsProps {
  user: User | null
  authLoading: boolean
  currentLocation: SelectedLocation
  onSelectLocation: (location: SelectedLocation) => void
  onOpenAuth?: () => void
  savedState?: ReturnType<typeof useSavedLocations>
  unit?: TemperatureUnit
}

function formatTemp(rawC: number | undefined, unit: TemperatureUnit = '°C'): string {
  if (rawC == null || isNaN(rawC)) return '--'
  if (unit === '°F') {
    return `${Math.round((rawC * 9) / 5 + 32)}°`
  }
  return `${Math.round(rawC)}°`
}

export function SavedLocations({
  user,
  authLoading,
  currentLocation,
  onSelectLocation,
  onOpenAuth,
  savedState: externalState,
  unit = '°C',
}: SavedLocationsProps) {
  // If parent didn't pass savedState, instantiate own hook
  const internalState = useSavedLocations(externalState ? null : user)
  const {
    locations,
    loading: locationsLoading,
    saving,
    removingId,
    error: firestoreError,
    isLocationSaved,
    saveLocation,
    removeLocation,
  } = externalState || internalState

  // Fetch live weather summaries in batch for all saved locations
  const {
    weatherMap,
    loading: weatherLoading,
    error: weatherError,
    refresh: refreshWeather,
  } = useSavedLocationsWeather(locations, user)

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
          <Bookmark size={15} /> SAVED LOCATIONS {locations.length > 0 ? `(${locations.length})` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {locations.length > 0 && (
            <button
              type="button"
              onClick={refreshWeather}
              disabled={weatherLoading}
              title="Refresh live weather for saved locations"
              aria-label="Refresh saved weather"
              style={{
                height: '30px',
                width: '30px',
                padding: 0,
                border: '2px solid var(--ink)',
                background: 'var(--surface)',
                boxShadow: '2px 2px 0 var(--ink)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} className={weatherLoading ? 'animate-spin' : ''} />
            </button>
          )}
          <button
            type="button"
            className="saved-locations-save-btn"
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
      </div>

      {firestoreError && (
        <div className="saved-locations-error">
          <AlertTriangle size={14} />
          <span>{firestoreError}</span>
        </div>
      )}

      {locationsLoading ? (
        <div className="saved-locations-status">
          <Loader2 size={14} className="animate-spin" />
          <span>LOADING YOUR LOCATIONS...</span>
        </div>
      ) : locations.length === 0 ? (
        <div className="saved-locations-status">
          NO SAVED LOCATIONS YET. SAVE THE CURRENT CITY TO RETURN TO IT QUICKLY.
        </div>
      ) : (
        <div className="saved-locations-cards">
          {locations.map((location) => {
            const live = weatherMap[location.id]
            const isItemLoading = weatherLoading && !live
            const isItemError = live?.error
            const isActive =
              Math.abs(currentLocation.latitude - location.latitude) < 0.05 &&
              Math.abs(currentLocation.longitude - location.longitude) < 0.05

            return (
              <div
                className={`saved-location-card ${isActive ? 'active' : ''}`}
                key={location.id}
              >
                <button
                  type="button"
                  className="saved-location-card-main"
                  onClick={() => {
                    const { id: _id, ...selectedLocation } = location
                    onSelectLocation({
                      ...selectedLocation,
                      timezone: 'auto',
                      source: 'SEARCH',
                    })
                  }}
                  title={`Switch to ${location.name}`}
                  aria-label={`Switch to ${location.name}, ${
                    live?.temperature ? formatTemp(live.temperature, unit) : ''
                  }`}
                >
                  {/* Card Header: City Name, Region, Weather Icon */}
                  <div className="saved-card-header">
                    <div className="saved-card-city">
                      <strong className="saved-card-name">{location.name}</strong>
                      <span className="saved-card-region">
                        {[location.admin1, location.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                    <div className="saved-card-icon-wrap">
                      <WeatherIcon type={live?.icon || 'sun'} size={20} />
                    </div>
                  </div>

                  {/* Card Body: Temperature, Condition, Feels-like */}
                  {isItemLoading ? (
                    <div className="saved-card-skeleton">
                      <div className="skeleton-bar temp-skeleton" />
                      <div className="skeleton-bar text-skeleton" />
                    </div>
                  ) : isItemError ? (
                    <div className="saved-card-error">
                      <span>Weather unavailable</span>
                    </div>
                  ) : (
                    <div className="saved-card-body">
                      <div className="saved-card-temp-row">
                        <span className="saved-card-temp">
                          {formatTemp(live?.temperature, unit)}
                        </span>
                        <span className="saved-card-condition">
                          {live?.condition || 'Clear'}
                        </span>
                      </div>
                      <div className="saved-card-sub-row">
                        {live?.feelsLike != null && (
                          <span className="saved-card-feels">
                            Feels {formatTemp(live.feelsLike, unit)}
                          </span>
                        )}
                        {live?.high != null && live?.low != null && (
                          <span className="saved-card-hi-lo">
                            H:{formatTemp(live.high, unit)} L:{formatTemp(live.low, unit)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Card Footer: AQI Badge and Live Indicator */}
                  <div className="saved-card-footer">
                    {live?.aqi != null ? (
                      <span
                        className={`saved-card-aqi ${
                          live.aqiStandard === 'CPCB' ? 'cpcb' : 'modeled'
                        }`}
                        title={live.aqiSourceName || undefined}
                      >
                        {live.aqiStandard === 'CPCB'
                          ? `CPCB ${live.aqi}`
                          : `US AQI ${live.aqi}`}
                      </span>
                    ) : (
                      <span className="saved-card-aqi-placeholder">
                        {isItemLoading ? 'AQI...' : 'AQI --'}
                      </span>
                    )}
                    <span className="saved-card-live-dot">
                      <i /> LIVE
                    </span>
                  </div>
                </button>

                {/* Remove button */}
                <button
                  type="button"
                  className="saved-location-remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeLocation(location.id)
                  }}
                  disabled={removingId === location.id}
                  aria-label={`Remove ${location.name}`}
                  title={`Remove ${location.name}`}
                >
                  {removingId === location.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
