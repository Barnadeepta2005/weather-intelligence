/**
 * Open-Meteo Geocoding client and reverse location resolution.
 *
 * Provides:
 * 1. Global forward geocoding via Open-Meteo's free Geocoding API:
 *    https://geocoding-api.open-meteo.com/v1/search
 * 2. Reverse geocode resolution for browser geolocation (using free, ₹0 public endpoints)
 *
 * Strict ₹0 recurring-cost requirement using open endpoints (no API keys required).
 */

import type { GeocodedLocation } from './types'

/**
 * Search locations globally using Open-Meteo Geocoding API.
 */
export async function searchLocations(
  query: string,
  count = 8
): Promise<GeocodedLocation[]> {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length < 2) {
    return []
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    trimmed
  )}&count=${count}&language=en&format=json`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`Open-Meteo geocoding error (HTTP ${res.status})`)
    }

    const json = await res.json()
    if (!json || !Array.isArray(json.results)) {
      return []
    }

    const results: GeocodedLocation[] = []

    for (const item of json.results) {
      if (
        item &&
        typeof item.name === 'string' &&
        typeof item.latitude === 'number' &&
        typeof item.longitude === 'number'
      ) {
        results.push({
          id: item.id ?? Math.floor(Math.random() * 1000000),
          name: item.name,
          country: item.country || 'Unknown Country',
          countryCode: item.country_code?.toUpperCase(),
          admin1: item.admin1 || undefined,
          latitude: item.latitude,
          longitude: item.longitude,
          timezone: item.timezone || 'UTC',
        })
      }
    }

    return results
  } finally {
    clearTimeout(timeoutId)
  }
}

export interface ReverseGeocodeResult {
  name: string
  country: string
  admin1?: string
  timezone?: string
}

/**
 * Resolve coordinates to a human-readable city/locality name for browser geolocation.
 * Uses BigDataCloud's free client-side reverse geocode endpoint with Nominatim fallback.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  // Strategy 1: BigDataCloud free client reverse geocoder
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(bdcUrl, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      const cityName = data.city || data.locality || data.principalSubdivision
      if (cityName && data.countryName) {
        return {
          name: cityName,
          country: data.countryName,
          admin1: data.principalSubdivision || undefined,
        }
      }
    }
  } catch {
    // Continue to fallback
  }

  // Strategy 2: OpenStreetMap Nominatim fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(nomUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WeatherIntelligenceApp/1.0' },
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      const addr = data.address
      if (addr) {
        const cityName =
          addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.state_district
        if (cityName && addr.country) {
          return {
            name: cityName,
            country: addr.country,
            admin1: addr.state || undefined,
          }
        }
      }
    }
  } catch {
    // Continue to fallback
  }

  // Strategy 3: Safe fallback using coordinates
  return {
    name: 'Current Location',
    country: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
  }
}
