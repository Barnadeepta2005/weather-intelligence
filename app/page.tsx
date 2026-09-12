'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { User } from 'firebase/auth'
import { AlertTriangle, RefreshCw, Eye, X, MapPin } from 'lucide-react'
import { Sidebar } from '@/components/Sidebar'
import { MobileNav } from '@/components/MobileNav'
import { TopBar } from '@/components/TopBar'
import { LocationStrip } from '@/components/LocationStrip'
import { HeroCard } from '@/components/HeroCard'
import { InsightCard } from '@/components/InsightCard'
import { HourlyForecast } from '@/components/HourlyForecast'
import { RadarCard } from '@/components/RadarCard'
import { AQICard } from '@/components/AQICard'
import { UVCard } from '@/components/UVCard'
import { HighlightsGrid } from '@/components/HighlightsGrid'
import { WeeklyForecast } from '@/components/WeeklyForecast'
import { OtherCities } from '@/components/OtherCities'
import { AuthControl } from '@/components/AuthControl'
import { SavedLocations } from '@/components/SavedLocations'
import { useSavedLocations } from '@/lib/useSavedLocations'
import {
  applyTemperatureUnit,
  DEFAULT_COORDINATES,
  type DashboardData,
} from '@/lib/open-meteo'
import { reverseGeocode } from '@/lib/geocoding'
import {
  mockHourlyForecast,
  mockWeeklyForecast,
  mockCities,
  mockCurrentConditions,
  mockAirQuality,
  mockUV,
  mockLocation,
  mockInsight,
  mockSearchSuggestions,
} from '@/lib/mock-data'
import type { TemperatureUnit, SelectedLocation, SearchSuggestion } from '@/lib/types'

// Default fallback baseline location (Kolkata)
const DEFAULT_LOCATION: SelectedLocation = {
  name: DEFAULT_COORDINATES.city,
  country: DEFAULT_COORDINATES.country,
  admin1: 'West Bengal',
  latitude: DEFAULT_COORDINATES.latitude,
  longitude: DEFAULT_COORDINATES.longitude,
  timezone: DEFAULT_COORDINATES.timezone,
  source: 'DEFAULT',
}

// Development reference demo data
const DEMO_REFERENCE_DATA: DashboardData = {
  isLive: false,
  location: { ...mockLocation, lastUpdated: 'OFFLINE REFERENCE' },
  currentConditions: mockCurrentConditions,
  airQuality: mockAirQuality,
  uv: mockUV,
  hourly: mockHourlyForecast,
  weekly: mockWeeklyForecast,
  insight: mockInsight,
  otherCities: mockCities,
  suggestions: mockSearchSuggestions,
  rawCelsiuses: {
    temp: mockCurrentConditions.temperature,
    feelsLike: mockCurrentConditions.feelsLike,
    high: mockCurrentConditions.high,
    low: mockCurrentConditions.low,
    hourly: mockHourlyForecast.map((h) => parseInt(h.temperature, 10) || 28),
    weeklyHighs: mockWeeklyForecast.map((w) => parseInt(w.high, 10) || 30),
    weeklyLows: mockWeeklyForecast.map((w) => parseInt(w.low, 10) || 24),
    otherCities: mockCities.map((c) => parseInt(c.temperature, 10) || 28),
  },
}

interface GeoNoticeInfo {
  title: string
  message: string
  advice?: string
  code?: number
}

export default function Page() {
  const [unit, setUnit] = useState<TemperatureUnit>('°C')
  const [location, setLocation] = useState<SelectedLocation>(DEFAULT_LOCATION)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Geolocation states
  const [isLocating, setIsLocating] = useState<boolean>(false)
  const [geoNotice, setGeoNotice] = useState<GeoNoticeInfo | null>(null)
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const signOutHandlerRef = useRef<(() => Promise<void>) | null>(null)

  const handleSignOutReady = useCallback((fn: () => Promise<void>) => {
    signOutHandlerRef.current = fn
  }, [])

  const handleSignOut = useCallback(() => {
    void signOutHandlerRef.current?.()
  }, [])

  const handleOpenAuth = useCallback(() => {
    setAuthModalOpen(true)
  }, [])

  const savedState = useSavedLocations(authUser)

  const handleAuthUserChange = useCallback((user: User | null) => {
    setAuthUser(user)
  }, [])

  const handleAuthLoadingChange = useCallback((nextLoading: boolean) => {
    setAuthLoading(nextLoading)
  }, [])

  // Initialize from URL search parameters if present
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const params = new URLSearchParams(window.location.search)
      const latStr = params.get('lat') || params.get('latitude')
      const lonStr = params.get('lon') || params.get('longitude')
      const city = params.get('city')
      const country = params.get('country')
      const admin1 = params.get('admin1') || undefined
      const tz = params.get('tz') || params.get('timezone')

      if (latStr && lonStr && city) {
        const lat = parseFloat(latStr)
        const lon = parseFloat(lonStr)
        if (!isNaN(lat) && !isNaN(lon)) {
          setLocation({
            name: city,
            country: country || 'Unknown Country',
            admin1,
            latitude: lat,
            longitude: lon,
            timezone: tz || 'auto',
            source: 'SEARCH',
          })
        }
      }
    } catch {
      // Keep default
    }
  }, [])

  // Sync URL when location changes
  const syncUrl = (loc: SelectedLocation) => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams({
        lat: String(loc.latitude),
        lon: String(loc.longitude),
        city: loc.name,
        country: loc.country,
      })
      if (loc.admin1) params.set('admin1', loc.admin1)
      if (loc.timezone && loc.timezone !== 'auto') params.set('tz', loc.timezone)

      window.history.replaceState(null, '', `?${params.toString()}`)
    } catch {
      // Ignore
    }
  }

  // Stale request protection
  const activeRequestRef = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch weather data whenever selected location changes
  const fetchWeatherForLocation = useCallback(async (targetLocation: SelectedLocation) => {
    // Abort previous in-flight fetch immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const requestId = ++activeRequestRef.current
    setLoading(true)
    setError(null)

    try {
      const query = new URLSearchParams({
        latitude: String(targetLocation.latitude),
        longitude: String(targetLocation.longitude),
        city: targetLocation.name,
        country: targetLocation.country,
        timezone: targetLocation.timezone,
      })

      const res = await fetch(`/api/weather?${query.toString()}`, {
        signal: controller.signal,
      })
      if (!res.ok) {
        const errPayload = await res.json().catch(() => null)
        throw new Error(errPayload?.error || `Weather fetch failed (HTTP ${res.status})`)
      }

      const liveData: DashboardData = await res.json()

      // Ignore if a newer request was dispatched
      if (requestId !== activeRequestRef.current) return

      // Ensure administrative region is carried over to the location strip
      if (targetLocation.admin1) {
        liveData.location.admin1 = targetLocation.admin1
      }

      setData(liveData)
      syncUrl(targetLocation)
    } catch (err: any) {
      if (err.name === 'AbortError') return // Silent cancellation for superseded request
      if (requestId === activeRequestRef.current) {
        setError(err?.message || 'Failed to retrieve live weather data.')
        setData(null)
      }
    } finally {
      if (requestId === activeRequestRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchWeatherForLocation(location)
  }, [location, fetchWeatherForLocation])

  // Handle location selection from search suggestions
  const handleSelectLocation = useCallback(
    (loc: {
      name: string
      country: string
      countryCode?: string
      admin1?: string
      latitude: number
      longitude: number
      timezone: string
    }) => {
      setGeoNotice(null)
      const newLoc: SelectedLocation = {
        name: loc.name,
        country: loc.country,
        countryCode: loc.countryCode,
        admin1: loc.admin1,
        latitude: loc.latitude,
        longitude: loc.longitude,
        timezone: loc.timezone,
        source: 'SEARCH',
      }
      setLocation(newLoc)
    },
    []
  )

  // Handle browser geolocation ("Use my location")
  const handleUseCurrentLocation = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoNotice({
        title: 'GEOLOCATION NOT SUPPORTED',
        message: 'Browser geolocation is not supported on this device or browser. Please use global city search instead.',
        advice: 'Try an updated modern web browser such as Chrome, Brave, Edge, or Safari.',
      })
      return
    }

    // Prevent duplicate simultaneous requests
    if (isLocating) {
      return
    }

    const isSecure = window.isSecureContext
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    const hasGeolocation = 'geolocation' in navigator

    // Development diagnostic logging
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Geolocation Diagnostics]', {
        hasGeolocation,
        isSecure,
        protocol,
        hostname,
      })
    }

    // Secure context requirement check
    if (!isSecure && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const msg = `INSECURE CONTEXT: Browser geolocation requires HTTPS or localhost. Current: ${protocol}//${hostname}`
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Geolocation]', msg)
      }
      setGeoNotice({
        title: 'SECURE CONTEXT REQUIRED',
        message: 'Browser geolocation is restricted by modern browsers to secure HTTPS connections.',
        advice: 'Access this app via https:// or localhost, or search for a city manually above.',
      })
      return
    }

    // Check permissions API if available
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      try {
        const permStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Geolocation Permission State]:', permStatus.state)
        }
        if (permStatus.state === 'denied') {
          setGeoNotice({
            title: 'LOCATION ACCESS BLOCKED',
            message: 'Location access has been blocked in your browser site permissions.',
            advice: 'Click the tune/padlock icon next to the URL in your address bar and set Location to "Allow", or check Windows Settings > Privacy & security > Location.',
            code: 1,
          })
          return
        }
      } catch {
        // Permissions query optional fallback
      }
    }

    setIsLocating(true)
    setGeoNotice(null)

    const options: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 300000,
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude

        if (process.env.NODE_ENV !== 'production') {
          console.log('[Geolocation Success Callback]:', {
            latitude: lat,
            longitude: lon,
            accuracyMeters: position.coords.accuracy,
          })
        }

        try {
          // Resolve nearest human-readable locality label through server-side route
          const revRes = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`)
          const resolved = revRes.ok ? await revRes.json() : null

          const newLoc: SelectedLocation = {
            name: resolved?.name || 'Current Location',
            country: resolved?.country || '',
            admin1: resolved?.admin1 || undefined,
            latitude: lat,
            longitude: lon,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto',
            source: 'GEOLOCATION',
          }
          setLocation(newLoc)
          setGeoNotice(null)
        } catch (revErr) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[Reverse Geocode Fallback]:', revErr)
          }
          const newLoc: SelectedLocation = {
            name: 'Current Location',
            country: `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`,
            latitude: lat,
            longitude: lon,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'auto',
            source: 'GEOLOCATION',
          }
          setLocation(newLoc)
          setGeoNotice(null)
        } finally {
          setIsLocating(false)
        }
      },
      (geoError) => {
        setIsLocating(false)

        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Geolocation Error Details]:', {
            code: geoError.code,
            message: geoError.message,
            codeName:
              geoError.code === 1
                ? 'PERMISSION_DENIED'
                : geoError.code === 2
                ? 'POSITION_UNAVAILABLE'
                : geoError.code === 3
                ? 'TIMEOUT'
                : 'UNKNOWN',
          })
        }

        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            setGeoNotice({
              title: 'LOCATION ACCESS BLOCKED',
              message: 'Location access was denied. Enable location permission in your browser or system settings, or search for a city.',
              advice: 'In your browser address bar, click the site settings icon and toggle Location to Allow.',
              code: 1,
            })
            break
          case geoError.POSITION_UNAVAILABLE:
            setGeoNotice({
              title: 'LOCATION UNAVAILABLE',
              message: 'Your device could not determine your physical location. On Windows desktop, this happens when Windows Location Services is disabled.',
              advice: 'Open Windows Settings > Privacy & security > Location and turn on "Location services", or search for a city manually.',
              code: 2,
            })
            break
          case geoError.TIMEOUT:
            setGeoNotice({
              title: 'LOCATION TIMEOUT',
              message: 'Location detection took too long. On Windows desktop, this occurs when the Windows Geolocation Service (lfsvc) is stopped or blocked.',
              advice: 'Ensure Windows Location is enabled under Windows Settings > Privacy & security > Location, or use city search above.',
              code: 3,
            })
            break
          default:
            setGeoNotice({
              title: 'LOCATION ERROR',
              message: geoError.message || 'Unable to acquire current location. Try again or search manually.',
              advice: 'You can search for any city globally using the search bar above.',
            })
        }
      },
      options
    )
  }, [isLocating])

  // Handle clicking on "Other cities" card
  const handleSelectOtherCity = useCallback(async (cityName: string) => {
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(cityName)}`)
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.results) && json.results.length > 0) {
          const match = json.results[0]
          handleSelectLocation(match)
        }
      }
    } catch {
      // Ignore
    }
  }, [handleSelectLocation])

  // Derive active view with unit conversion (°C / °F) client-side with 0 network requests
  const activeData = useMemo(() => {
    if (!data) return null
    return applyTemperatureUnit(data, unit)
  }, [data, unit])

  const enableDemoMode = () => {
    setError(null)
    setLoading(false)
    setData(DEMO_REFERENCE_DATA)
  }

  // Pre-fill search suggestions from other cities
  const topBarSuggestions: SearchSuggestion[] = useMemo(() => {
    if (activeData?.suggestions && activeData.suggestions.length > 0) {
      return activeData.suggestions
    }
    return mockSearchSuggestions
  }, [activeData])

  return (
    <main className="weather-app">
      <Sidebar
        user={authUser}
        onOpenAuth={handleOpenAuth}
        onSignOut={handleSignOut}
        onNavigatePlaces={() => {
          document.querySelector('.saved-locations')?.scrollIntoView({ behavior: 'smooth' })
        }}
      />
      <section className="content-shell">
        <MobileNav
          onUseCurrentLocation={handleUseCurrentLocation}
          isLocating={isLocating}
          user={authUser}
          authLoading={authLoading}
          onOpenAuth={handleOpenAuth}
          onSignOut={handleSignOut}
        />
        <TopBar
          unit={unit}
          onUnitChange={setUnit}
          onSelectLocation={handleSelectLocation}
          onUseCurrentLocation={handleUseCurrentLocation}
          isLocating={isLocating}
          suggestions={topBarSuggestions}
          authControl={
            <AuthControl
              onUserChange={handleAuthUserChange}
              onLoadingChange={handleAuthLoadingChange}
              isOpen={authModalOpen}
              onOpenChange={setAuthModalOpen}
              onSignOutReady={handleSignOutReady}
            />
          }
        />

        {/* GEOLOCATION NOTIFICATION BANNER WITH ERROR RECOVERY */}
        {geoNotice && (
          <div
            style={{
              padding: '14px 18px',
              marginTop: '16px',
              border: '2.5px solid var(--ink)',
              boxShadow: '4px 4px 0 var(--ink)',
              background: '#fff2c6',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, color: '#b45309' }}>
                <MapPin size={16} />
                <span style={{ fontSize: '12px', letterSpacing: '0.04em' }}>{geoNotice.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setGeoNotice(null)}
                aria-label="Dismiss notice"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  padding: '2px',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '11px', color: '#333', lineHeight: 1.45 }}>
              {geoNotice.message}
            </p>

            {geoNotice.advice && (
              <p style={{ margin: 0, fontSize: '10px', color: '#78350f', fontWeight: 700 }}>
                💡 {geoNotice.advice}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="primary-btn"
                style={{
                  height: '30px',
                  padding: '0 12px',
                  fontSize: '10px',
                  marginTop: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '2px 2px 0 var(--ink)',
                }}
              >
                <RefreshCw size={12} className={isLocating ? 'animate-spin' : ''} />
                TRY AGAIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeoNotice(null)
                  const searchBtn = document.querySelector('.search-btn') as HTMLButtonElement | null
                  searchBtn?.click()
                  const searchInput = document.querySelector('.search-expanded-box input') as HTMLInputElement | null
                  searchInput?.focus()
                }}
                className="secondary-btn"
                style={{
                  height: '30px',
                  padding: '0 12px',
                  fontSize: '10px',
                  background: 'var(--surface)',
                  border: '2px solid var(--ink)',
                  boxShadow: '2px 2px 0 var(--ink)',
                  cursor: 'pointer',
                  fontWeight: 900,
                }}
              >
                SEARCH CITY
              </button>
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div
            style={{
              padding: '36px 24px',
              marginTop: '20px',
              border: '3px solid var(--ink)',
              boxShadow: '4px 4px 0 var(--ink)',
              background: 'var(--acid)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 900,
              fontSize: '14px',
              letterSpacing: '0.05em',
            }}
          >
            <span>
              FETCHING LIVE WEATHER FOR {location.name.toUpperCase()}...
            </span>
            <RefreshCw size={20} className="animate-spin" />
          </div>
        )}

        {/* ERROR STATE — REAL-TIME HONESTY */}
        {!loading && error && (
          <div
            style={{
              padding: '32px 24px',
              marginTop: '20px',
              border: '3px solid var(--ink)',
              boxShadow: '5px 5px 0 var(--ink)',
              background: '#ffe5e5',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertTriangle size={28} color="#dc2626" />
              <h2 style={{ fontSize: '24px', margin: 0, fontWeight: 900, letterSpacing: '-0.02em' }}>
                WEATHER SERVICE UNAVAILABLE
              </h2>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', lineHeight: 1.5, color: '#333' }}>
              <strong>Error:</strong> {error}
            </p>
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#666' }}>
              The application refused to fabricate mock weather values to preserve live accuracy.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => fetchWeatherForLocation(location)}
                className="primary-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  background: 'var(--acid)',
                  cursor: 'pointer',
                  fontWeight: 900,
                  fontSize: '12px',
                }}
              >
                <RefreshCw size={15} /> RETRY CONNECTION
              </button>
              <button
                onClick={enableDemoMode}
                className="secondary-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  cursor: 'pointer',
                  fontWeight: 900,
                  fontSize: '12px',
                }}
              >
                <Eye size={15} /> VIEW DEMO REFERENCE (OFFLINE)
              </button>
            </div>
          </div>
        )}

        {/* SUCCESS STATE — REAL DATA DASHBOARD */}
        {!loading && activeData && (
          <>
            {/* EXPLICIT DEMO MODE BANNER — NEVER SILENT */}
            {!activeData.isLive && (
              <div
                style={{
                  margin: '16px 0 4px 0',
                  padding: '12px 18px',
                  background: '#fff9db',
                  border: '2.5px solid var(--ink)',
                  boxShadow: '4px 4px 0 var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  fontSize: '11px',
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#854d0e' }}>
                  <AlertTriangle size={16} />
                  <span>DEMO MODE — OFFLINE REFERENCE DATA</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchWeatherForLocation(location)}
                  className="primary-btn"
                  style={{
                    margin: 0,
                    height: '28px',
                    padding: '0 12px',
                    fontSize: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '2px 2px 0 var(--ink)',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={12} /> RESTORE LIVE DATA
                </button>
              </div>
            )}
            <LocationStrip
              location={activeData.location}
              isLive={activeData.isLive}
              isSaved={savedState.isLocationSaved(location.latitude, location.longitude)}
              onToggleSave={() => savedState.toggleLocation(location)}
              isSaving={savedState.saving}
              isAuthenticated={Boolean(authUser)}
              onOpenAuth={handleOpenAuth}
            />
            <SavedLocations
              user={authUser}
              authLoading={authLoading}
              currentLocation={location}
              onSelectLocation={handleSelectLocation}
              onOpenAuth={handleOpenAuth}
              savedState={savedState}
            />
            <div className="dashboard-grid">
              <HeroCard conditions={activeData.currentConditions} />
              <InsightCard insight={activeData.insight} />
              <HourlyForecast entries={activeData.hourly} />
              <RadarCard
                latitude={location.latitude}
                longitude={location.longitude}
                cityName={location.name}
                timezone={location.timezone}
              />
              <div className="side-stack">
                <AQICard data={activeData.airQuality} />
                <UVCard data={activeData.uv} />
              </div>
              <HighlightsGrid conditions={activeData.currentConditions} />
              <WeeklyForecast entries={activeData.weekly} />
              <OtherCities
                cities={activeData.otherCities}
                onSelectCity={handleSelectOtherCity}
                onAddLocation={() => {
                  const searchBtn = document.querySelector('.search-btn') as HTMLButtonElement | null
                  searchBtn?.click()
                  setTimeout(() => {
                    const searchInput = document.querySelector('.search-expanded-box input') as HTMLInputElement | null
                    searchInput?.focus()
                  }, 50)
                }}
              />
            </div>
          </>
        )}
      </section>
    </main>
  )
}
