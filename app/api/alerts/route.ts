import { NextRequest, NextResponse } from 'next/server'
import { getAlertsForLocation } from '@/lib/alerts/imd-service'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(request, 'alerts', { limit: 30, windowMs: 60_000 })
  if (!rateLimit.success) {
    return createRateLimitResponse(rateLimit)
  }

  const { searchParams } = new URL(request.url)
  const latStr = searchParams.get('latitude') || searchParams.get('lat')
  const lonStr = searchParams.get('longitude') || searchParams.get('lon')
  const city = searchParams.get('city') || ''
  const admin1 = searchParams.get('admin1') || searchParams.get('state') || ''
  const country = searchParams.get('country') || ''
  const countryCode = searchParams.get('countryCode') || ''

  const latitude = latStr ? parseFloat(latStr) : NaN
  const longitude = lonStr ? parseFloat(lonStr) : NaN

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json(
      {
        hasActiveAlerts: false,
        alerts: [],
        error: 'Invalid coordinates provided. Latitude and longitude must be numbers.',
        lastUpdated: new Date().toISOString(),
        attribution: 'India Meteorological Department (IMD)',
        isLive: false,
      },
      { status: 400 }
    )
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json(
      {
        hasActiveAlerts: false,
        alerts: [],
        error: 'Coordinates out of range.',
        lastUpdated: new Date().toISOString(),
        attribution: 'India Meteorological Department (IMD)',
        isLive: false,
      },
      { status: 400 }
    )
  }

  // If explicitly non-Indian location, return clean no-alert state immediately
  const isForeign =
    (countryCode && countryCode.toUpperCase() !== 'IN') ||
    (country && !country.toLowerCase().includes('india'))

  // Coordinate check for India bounding box roughly [lat: 6-38, lon: 68-98]
  const isOutOfIndiaCoords =
    latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98

  if (isForeign && isOutOfIndiaCoords) {
    return NextResponse.json(
      {
        hasActiveAlerts: false,
        alerts: [],
        lastUpdated: new Date().toISOString(),
        attribution: 'Official Warning Providers (India: IMD)',
        isLive: true,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    )
  }

  const safeCity = city.slice(0, 100)
  const safeAdmin1 = admin1.slice(0, 100)

  try {
    const alertsData = await getAlertsForLocation(latitude, longitude, safeCity, safeAdmin1)

    return NextResponse.json(alertsData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Weather alerts temporarily unavailable'
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[API /api/alerts] Error retrieving alerts:', message)
    }
    // Fail-safe: Return clean empty state rather than 500/502 to protect UI
    return NextResponse.json(
      {
        hasActiveAlerts: false,
        alerts: [],
        lastUpdated: new Date().toISOString(),
        attribution: 'India Meteorological Department (IMD)',
        isLive: false,
        error: message,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  }
}
