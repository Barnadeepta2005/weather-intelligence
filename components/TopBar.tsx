'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Navigation, Loader2, AlertTriangle } from 'lucide-react'
import type { TemperatureUnit, SearchSuggestion, GeocodedLocation } from '@/lib/types'
import type { ReactNode } from 'react'

export interface TopBarProps {
  unit: TemperatureUnit
  onUnitChange: (unit: TemperatureUnit) => void
  onSelectLocation: (location: {
    name: string
    country: string
    countryCode?: string
    admin1?: string
    latitude: number
    longitude: number
    timezone: string
  }) => void
  onUseCurrentLocation: () => void
  isLocating?: boolean
  suggestions?: SearchSuggestion[]
  authControl?: ReactNode
}

export function TopBar({
  unit,
  onUnitChange,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating = false,
  suggestions = [],
  authControl,
}: TopBarProps) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [results, setResults] = useState<GeocodedLocation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRequestIdRef = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fetch geocoding results
  const fetchGeocode = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setResults([])
      setIsSearching(false)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)

    const requestId = ++activeRequestIdRef.current

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.error || `Search failed (HTTP ${res.status})`)
      }

      const data = await res.json()

      // Stale-request protection
      if (requestId === activeRequestIdRef.current) {
        setResults(Array.isArray(data.results) ? data.results : [])
        setSelectedIndex(-1)
        setIsSearching(false)
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && requestId === activeRequestIdRef.current) {
        setSearchError(err?.message || 'Could not reach the location service.')
        setResults([])
        setIsSearching(false)
      }
    }
  }, [])

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGeocode(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, fetchGeocode])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setQuery('')
        setResults([])
        setSearchError(null)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const handleSelectResult = useCallback(
    (item: GeocodedLocation) => {
      onSelectLocation({
        name: item.name,
        country: item.country,
        countryCode: item.countryCode,
        admin1: item.admin1,
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone,
      })
      setSearchOpen(false)
      setQuery('')
      setResults([])
      setSearchError(null)
      setSelectedIndex(-1)
    },
    [onSelectLocation]
  )

  const handleSelectSuggestedCity = useCallback(
    async (cityName: string) => {
      setQuery(cityName)
      fetchGeocode(cityName)
    },
    [fetchGeocode]
  )

  const handleClose = () => {
    setSearchOpen(false)
    setQuery('')
    setResults([])
    setSearchError(null)
    setSelectedIndex(-1)
  }

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClose()
      return
    }

    if (results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectResult(results[selectedIndex])
      } else if (results.length > 0) {
        handleSelectResult(results[0])
      }
    }
  }

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">WEATHER INTELLIGENCE / 01</p>
        <h1>Know what&apos;s coming.</h1>
      </div>

      <div className="top-actions">
        {/* SEARCH WIDGET WITH ANCHORED POPUP */}
        <div className="search-container" ref={containerRef}>
          {searchOpen ? (
            <>
              <div className="search-expanded-box">
                <Search size={16} />
                <input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="SEARCH CITY (MIN 2 CHARS)..."
                  aria-label="Search city"
                  aria-expanded="true"
                />
                {isSearching && <Loader2 size={15} className="animate-spin" style={{ color: 'var(--ink)' }} />}
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close search"
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

              {/* DROPDOWN POPOVER — ANCHORED DIRECTLY BELOW INPUT */}
              <div className="search-dropdown" role="listbox" aria-label="City search results">
                {query.trim().length >= 2 ? (
                  <>
                    <div className="search-dropdown-header">
                      <span>SEARCH RESULTS</span>
                      {isSearching && <span>SEARCHING...</span>}
                    </div>

                    {isSearching && results.length === 0 && (
                      <div className="search-loading-state">
                        <Loader2 size={18} className="animate-spin" />
                        <span>Searching global cities...</span>
                      </div>
                    )}

                    {!isSearching && results.length === 0 && !searchError && (
                      <div className="search-empty-state">
                        <strong>NO CITIES FOUND</strong>
                        <p>Try another city or country.</p>
                      </div>
                    )}

                    {searchError && (
                      <div className="search-error-state">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}>
                          <AlertTriangle size={15} />
                          <strong>SEARCH UNAVAILABLE</strong>
                        </div>
                        <p>Could not reach the location service.</p>
                        <button
                          type="button"
                          className="search-retry-btn"
                          onClick={() => fetchGeocode(query)}
                        >
                          RETRY
                        </button>
                      </div>
                    )}

                    {results.map((item, index) => {
                      const isHighlighted = index === selectedIndex
                      return (
                        <button
                          key={`geo-${item.id}-${item.latitude}-${item.longitude}-${index}`}
                          type="button"
                          className={`search-row-btn ${isHighlighted ? 'selected-item' : ''}`}
                          onClick={() => handleSelectResult(item)}
                          role="option"
                          aria-selected={isHighlighted}
                        >
                          <div className="search-row-main">
                            <div className="search-row-city">{item.name}</div>
                            <div className="search-row-sub">
                              {[item.admin1, item.country].filter(Boolean).join(', ')}
                            </div>
                          </div>
                          {item.countryCode && (
                            <span className="search-row-badge">{item.countryCode}</span>
                          )}
                        </button>
                      )
                    })}
                  </>
                ) : (
                  <>
                    <div className="search-dropdown-header">
                      <span>SUGGESTED CITIES</span>
                    </div>
                    {suggestions.slice(0, 5).map((s, index) => (
                      <button
                        key={`sug-${s.city}-${s.country}-${index}`}
                        type="button"
                        className="search-row-btn"
                        onClick={() => handleSelectSuggestedCity(s.city)}
                      >
                        <div className="search-row-main">
                          <div className="search-row-city">{s.city}</div>
                          <div className="search-row-sub">{s.country}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              className="search-btn"
              onClick={() => {
                setSearchOpen(true)
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
            >
              <Search size={17} />
              <span>SEARCH CITY...</span>
            </button>
          )}
        </div>

        {/* USE MY LOCATION BUTTON */}
        <button
          type="button"
          className="location-button"
          onClick={onUseCurrentLocation}
          disabled={isLocating}
          aria-label="Use current location"
          style={{
            cursor: isLocating ? 'wait' : 'pointer',
            opacity: isLocating ? 0.7 : 1,
          }}
        >
          {isLocating ? <Loader2 size={15} className="animate-spin" /> : <Navigation size={15} />}
        </button>

        {/* UNIT TOGGLE */}
        <div className="unit-toggle">
          <button
            type="button"
            className={unit === '°C' ? 'selected' : ''}
            onClick={() => onUnitChange('°C')}
          >
            °C
          </button>
          <button
            type="button"
            className={unit === '°F' ? 'selected' : ''}
            onClick={() => onUnitChange('°F')}
          >
            °F
          </button>
        </div>

        {authControl}
      </div>
    </header>
  )
}
