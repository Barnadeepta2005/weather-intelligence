'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { User } from 'firebase/auth'
import type { SavedLocationRecord } from '@/lib/useSavedLocations'
import type { SavedLocationWeather } from '@/lib/types'

export function useSavedLocationsWeather(locations: SavedLocationRecord[], user: User | null) {
  const [weatherMap, setWeatherMap] = useState<Record<string, SavedLocationWeather>>({})
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const activeRequestRef = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const locationsRef = useRef<SavedLocationRecord[]>(locations)
  locationsRef.current = locations

  const fetchSavedWeather = useCallback(async (targetLocations: SavedLocationRecord[]) => {
    if (targetLocations.length === 0) {
      setWeatherMap({})
      setLoading(false)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const requestId = ++activeRequestRef.current
    setLoading(true)
    setError(null)

    try {
      const payload = {
        locations: targetLocations.map((loc) => ({
          id: loc.id,
          name: loc.name,
          country: loc.country,
          admin1: loc.admin1,
          latitude: loc.latitude,
          longitude: loc.longitude,
          timezone: 'auto',
        })),
      }

      const res = await fetch('/api/saved-weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`Failed to fetch live saved weather (HTTP ${res.status})`)
      }

      const data = await res.json()
      if (requestId !== activeRequestRef.current) return

      if (Array.isArray(data.results)) {
        setWeatherMap((prev) => {
          const next: Record<string, SavedLocationWeather> = {}
          // Only retain locations currently present in targetLocations (prevents stale cards)
          const validIds = new Set(locationsRef.current.map((l) => l.id))

          for (const item of data.results) {
            if (validIds.has(item.locationId)) {
              next[item.locationId] = item
            }
          }
          return next
        })
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      if (requestId === activeRequestRef.current) {
        console.warn('[useSavedLocationsWeather] Error fetching saved weather:', err)
        setError(err?.message || 'Failed to load weather for saved locations')
      }
    } finally {
      if (requestId === activeRequestRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // Sync with locations changes
  useEffect(() => {
    if (!user || locations.length === 0) {
      setWeatherMap({})
      setLoading(false)
      setError(null)
      return
    }

    // Immediately remove any deleted locations from weatherMap
    setWeatherMap((prev) => {
      const currentIds = new Set(locations.map((l) => l.id))
      let hasDeletions = false
      const next: Record<string, SavedLocationWeather> = {}
      for (const [id, val] of Object.entries(prev)) {
        if (currentIds.has(id)) {
          next[id] = val
        } else {
          hasDeletions = true
        }
      }
      return hasDeletions ? next : prev
    })

    fetchSavedWeather(locations)
  }, [locations, user, fetchSavedWeather])

  const refresh = useCallback(() => {
    if (locationsRef.current.length > 0 && user) {
      fetchSavedWeather(locationsRef.current)
    }
  }, [user, fetchSavedWeather])

  return {
    weatherMap,
    loading,
    error,
    refresh,
  }
}
