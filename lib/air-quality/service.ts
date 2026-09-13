/**
 * Central Air Quality Service Orchestrator.
 *
 * Routes air quality requests based on geographic location:
 * - INDIA: Matches nearest CPCB CAAQMS ground station within threshold.
 *          If valid ground data is available -> CPCB NAQI.
 *          If out of range or station offline -> Modeled fallback (Open-Meteo CAMS, labeled).
 * - GLOBAL: Open-Meteo CAMS atmospheric dispersion model.
 *
 * Enforces strict data integrity: All AQI and pollutant fields share the same context.
 */

import type { UnifiedAirQuality } from '@/lib/types'
import { findNearbyStations, DEFAULT_PROXIMITY_THRESHOLD_KM } from './cpcb-stations'
import { fetchCPCBStationAQI } from './india-cpcb'
import { fetchGlobalModelAQI } from './global-model'

export interface AirQualityRequest {
  latitude: number
  longitude: number
  country?: string
  city?: string
  timezone?: string
  maxStationDistanceKm?: number
}

/**
 * Check if the given location is within India (by country name or bounding box).
 */
export function isLocationInIndia(country?: string, lat?: number, lon?: number): boolean {
  if (country) {
    const c = country.trim().toUpperCase()
    if (c === 'INDIA' || c === 'IN' || c.includes('INDIA')) {
      return true
    }
  }

  if (typeof lat === 'number' && typeof lon === 'number') {
    // India approximate bounding box: 6.5°N - 37.5°N, 68.0°E - 97.5°E
    if (lat >= 6.5 && lat <= 37.5 && lon >= 68.0 && lon <= 97.5) {
      return true
    }
  }

  return false
}

/**
 * Resolve unified air quality for any global coordinate.
 */
export async function getAirQuality({
  latitude,
  longitude,
  country = '',
  city = '',
  timezone = 'auto',
  maxStationDistanceKm = DEFAULT_PROXIMITY_THRESHOLD_KM,
}: AirQualityRequest): Promise<UnifiedAirQuality> {
  const inIndia = isLocationInIndia(country, latitude, longitude)

  if (inIndia) {
    // 1. Check for nearby official CPCB ground monitoring stations
    const nearbyStations = findNearbyStations(latitude, longitude, maxStationDistanceKm)

    if (nearbyStations.length > 0) {
      // Try candidate stations in order of proximity
      for (const match of nearbyStations) {
        const stationName = match.station.station
        const groundData = await fetchCPCBStationAQI(stationName)

        if (groundData) {
          // Success: Valid official CPCB observation
          return groundData
        }
      }
    }

    // 2. Station unavailable or out-of-range: Graceful labeled modeled fallback
    try {
      return await fetchGlobalModelAQI({
        latitude,
        longitude,
        timezone,
        isFallback: true, // Marked as fallback
      })
    } catch (fallbackErr: unknown) {
      const errMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
      console.warn('[AirQualityService] India fallback model fetch failed:', errMsg)
    }
  } else {
    // 3. International location: Global Open-Meteo CAMS atmospheric model
    try {
      return await fetchGlobalModelAQI({
        latitude,
        longitude,
        timezone,
        isFallback: false,
      })
    } catch (globalErr: unknown) {
      const errMsg = globalErr instanceof Error ? globalErr.message : String(globalErr)
      console.warn('[AirQualityService] Global model fetch failed:', errMsg)
    }
  }

  // 4. Honest fallback when all upstream providers fail
  return {
    index: null,
    standard: 'US',
    sourceType: 'ATMOSPHERIC_MODEL',
    sourceName: 'Data Unavailable',
    level: 'UNAVAILABLE',
    pm25: null,
    pm10: null,
    o3: null,
    no2: null,
    timestamp: new Date().toISOString(),
    isFallback: true,
  }
}
