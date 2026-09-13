import { NextRequest, NextResponse } from 'next/server'
import { fetchWithTimeout } from '@/lib/open-meteo'
import { mapWeatherCode } from '@/lib/weather-utils'
import { getAirQuality } from '@/lib/air-quality/service'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import type { SavedLocationWeather } from '@/lib/types'

interface SavedLocationInput {
  id: string
  name: string
  country: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

interface OpenMeteoBatchForecast {
  current?: {
    temperature_2m?: number
    apparent_temperature?: number
    weather_code?: number
  }
  daily?: {
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
  }
}

const MAX_SAVED_LOCATIONS = 16

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'saved-weather', { limit: 60, windowMs: 60_000 })
  if (!rateLimit.success) {
    return createRateLimitResponse(rateLimit)
  }

  try {
    const body = await request.json().catch(() => ({}))
    const rawLocations = body?.locations

    if (!Array.isArray(rawLocations) || rawLocations.length === 0) {
      return NextResponse.json({ results: [] }, { status: 200 })
    }

    // Bounded count protection
    const locations: SavedLocationInput[] = rawLocations.slice(0, MAX_SAVED_LOCATIONS)

    // Separate valid coordinate items from invalid items
    const validItems: SavedLocationInput[] = []
    const invalidItems: SavedLocationInput[] = []

    for (const loc of locations) {
      const lat = Number(loc.latitude)
      const lon = Number(loc.longitude)
      if (
        typeof loc.id === 'string' &&
        !isNaN(lat) &&
        !isNaN(lon) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
      ) {
        validItems.push({
          id: String(loc.id).slice(0, 100),
          name: String(loc.name || 'Unknown').slice(0, 100),
          country: String(loc.country || '').slice(0, 100),
          admin1: loc.admin1 ? String(loc.admin1).slice(0, 100) : undefined,
          latitude: lat,
          longitude: lon,
          timezone: loc.timezone ? String(loc.timezone).slice(0, 50) : 'auto',
        })
      } else {
        invalidItems.push(loc)
      }
    }

    // 1. Fetch Open-Meteo batch forecast in a single network call
    let forecastList: (OpenMeteoBatchForecast | null)[] = []
    let openMeteoSuccess = false

    if (validItems.length > 0) {
      try {
        const lats = validItems.map((item) => item.latitude.toFixed(4)).join(',')
        const lons = validItems.map((item) => item.longitude.toFixed(4)).join(',')
        const openMeteoUrl =
          `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}` +
          `&current=temperature_2m,apparent_temperature,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min&timezone=auto`

        const res = await fetchWithTimeout(openMeteoUrl, 7000)
        if (res.ok) {
          const json = await res.json()
          forecastList = Array.isArray(json) ? json : [json]
          openMeteoSuccess = true
        }
      } catch (err: unknown) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[API /api/saved-weather] Open-Meteo batch request failed:', err)
        }
      }
    }

    // 2. Fetch Air Quality for each valid item in parallel (relying on server in-memory caching)
    const aqiPromises = validItems.map((item) =>
      getAirQuality({
        latitude: item.latitude,
        longitude: item.longitude,
        country: item.country,
        city: item.name,
        timezone: item.timezone,
      })
    )
    const aqiResults = await Promise.allSettled(aqiPromises)

    // 3. Assemble normalized SavedLocationWeather objects
    const results: SavedLocationWeather[] = []

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i]
      const forecast = openMeteoSuccess ? forecastList[i] : null
      const aqiRes = aqiResults[i]

      if (!forecast || !forecast.current || typeof forecast.current.temperature_2m !== 'number') {
        // Localized error for this specific card
        results.push({
          locationId: item.id,
          name: item.name,
          country: item.country,
          admin1: item.admin1,
          latitude: item.latitude,
          longitude: item.longitude,
          temperature: 0,
          condition: 'Unavailable',
          icon: 'cloud',
          updatedAt: new Date().toISOString(),
          error: true,
        })
        continue
      }

      const current = forecast.current
      const daily = forecast.daily || {}
      const wCode = typeof current.weather_code === 'number' ? current.weather_code : 0
      const mapped = mapWeatherCode(wCode)

      const tempC = Math.round(current.temperature_2m ?? 0)
      const feelsLikeC =
        typeof current.apparent_temperature === 'number'
          ? Math.round(current.apparent_temperature)
          : undefined
      const highC =
        Array.isArray(daily.temperature_2m_max) && typeof daily.temperature_2m_max[0] === 'number'
          ? Math.round(daily.temperature_2m_max[0])
          : undefined
      const lowC =
        Array.isArray(daily.temperature_2m_min) && typeof daily.temperature_2m_min[0] === 'number'
          ? Math.round(daily.temperature_2m_min[0])
          : undefined

      let aqi: number | null = null
      let aqiStandard: 'CPCB' | 'US' | 'EUROPEAN' | undefined
      let aqiSourceType: 'GROUND_STATION' | 'ATMOSPHERIC_MODEL' | undefined
      let aqiSourceName: string | undefined

      if (aqiRes && aqiRes.status === 'fulfilled' && aqiRes.value) {
        const unified = aqiRes.value
        aqi = typeof unified.index === 'number' ? unified.index : null
        aqiStandard = unified.standard
        aqiSourceType = unified.sourceType
        aqiSourceName = unified.sourceName
      }

      results.push({
        locationId: item.id,
        name: item.name,
        country: item.country,
        admin1: item.admin1,
        latitude: item.latitude,
        longitude: item.longitude,
        temperature: tempC,
        feelsLike: feelsLikeC,
        condition: mapped.condition,
        icon: mapped.icon,
        high: highC,
        low: lowC,
        aqi,
        aqiStandard,
        aqiSourceType,
        aqiSourceName,
        updatedAt: new Date().toISOString(),
        error: false,
      })
    }

    // Add any invalid items as error entries
    for (const inv of invalidItems) {
      results.push({
        locationId: inv.id || 'invalid',
        name: inv.name || 'Unknown',
        country: inv.country || '',
        admin1: inv.admin1,
        latitude: inv.latitude || 0,
        longitude: inv.longitude || 0,
        temperature: 0,
        condition: 'Invalid coordinates',
        icon: 'cloud',
        updatedAt: new Date().toISOString(),
        error: true,
      })
    }

    return NextResponse.json(
      { results },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process saved weather batch request'
    if (process.env.NODE_ENV !== 'production') {
      console.error('[API /api/saved-weather] Unhandled error:', message)
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
