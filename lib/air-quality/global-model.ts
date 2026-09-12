/**
 * Global Air Quality Model Provider (Open-Meteo / Copernicus CAMS).
 *
 * Provides gridded atmospheric dispersion modeling for:
 * 1. All international locations outside India.
 * 2. Indian locations where no suitable CPCB monitoring station is available or monitored data is offline.
 *
 * Real-time honesty: Always explicitly labeled as ATMOSPHERIC_MODEL.
 */

import type { UnifiedAirQuality } from '@/lib/types'
import { classifyUSAQI } from '@/lib/weather-utils'

interface CacheEntry {
  data: UnifiedAirQuality
  expiresAt: number
}

const modelCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export interface GlobalModelOptions {
  latitude: number
  longitude: number
  timezone?: string
  isFallback?: boolean
}

/**
 * Fetch modeled air quality from Open-Meteo CAMS.
 */
export async function fetchGlobalModelAQI({
  latitude,
  longitude,
  timezone = 'auto',
  isFallback = false,
}: GlobalModelOptions): Promise<UnifiedAirQuality> {
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)},${Boolean(isFallback)}`
  const cached = modelCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const airQualityUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}` +
    `&current=us_aqi,european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone` +
    `&timezone=${encodeURIComponent(timezone || 'auto')}`

  const res = await fetch(airQualityUrl, {
    signal: AbortSignal.timeout(6000),
    headers: { 'User-Agent': 'Weather-App-Global-Client/1.0' },
  })

  if (!res.ok) {
    throw new Error(`Open-Meteo Air Quality API returned HTTP ${res.status}`)
  }

  const aqJson = await res.json()
  const c = aqJson?.current

  const usAqi = typeof c?.us_aqi === 'number' ? Math.round(c.us_aqi) : null
  const euAqi = typeof c?.european_aqi === 'number' ? Math.round(c.european_aqi) : null

  const pm25 = typeof c?.pm2_5 === 'number' ? Math.round(c.pm2_5) : null
  const pm10 = typeof c?.pm10 === 'number' ? Math.round(c.pm10) : null
  const o3 = typeof c?.ozone === 'number' ? Math.round(c.ozone) : null
  const no2 = typeof c?.nitrogen_dioxide === 'number' ? Math.round(c.nitrogen_dioxide) : null

  const index = usAqi !== null ? usAqi : euAqi
  const standard: 'US' | 'EUROPEAN' = usAqi !== null ? 'US' : 'EUROPEAN'
  const level = index !== null ? classifyUSAQI(index) : 'UNAVAILABLE'

  const sourceName = isFallback
    ? 'Copernicus CAMS Model (Station data unavailable)'
    : 'Copernicus CAMS Model'

  const unified: UnifiedAirQuality = {
    index,
    standard,
    sourceType: 'ATMOSPHERIC_MODEL',
    sourceName,
    level,
    prominentPollutant: undefined, // Honest: Do not fabricate prominent pollutant for gridded model
    pm25,
    pm10,
    o3,
    no2,
    timestamp: c?.time || new Date().toISOString(),
    isFallback,
    usAqi: usAqi ?? undefined,
    europeanAqi: euAqi ?? undefined,
  }

  modelCache.set(cacheKey, {
    data: unified,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })

  return unified
}
