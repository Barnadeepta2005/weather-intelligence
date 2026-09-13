import { NextRequest, NextResponse } from 'next/server'
import { getWeatherTrends } from '@/lib/trends/service'
import type { TrendRange } from '@/lib/trends/types'
import { DEFAULT_COORDINATES } from '@/lib/open-meteo'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const latStr = searchParams.get('latitude') || searchParams.get('lat')
  const lonStr = searchParams.get('longitude') || searchParams.get('lon')
  const rangeParam = (searchParams.get('range') || '7d').toLowerCase()
  const timezone = searchParams.get('timezone') || DEFAULT_COORDINATES.timezone

  const latitude = latStr ? parseFloat(latStr) : DEFAULT_COORDINATES.latitude
  const longitude = lonStr ? parseFloat(lonStr) : DEFAULT_COORDINATES.longitude

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json(
      { error: 'Invalid coordinates provided. Latitude and longitude must be numbers.' },
      { status: 400 }
    )
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json(
      { error: 'Coordinates out of range. Latitude must be between -90 and 90, longitude between -180 and 180.' },
      { status: 400 }
    )
  }

  const validRange: TrendRange =
    rangeParam === '30d' ? '30d' : rangeParam === '14d' ? '14d' : '7d'

  const safeTimezone = timezone.slice(0, 50)

  try {
    const data = await getWeatherTrends(latitude, longitude, safeTimezone, validRange)
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    })
  } catch (error: any) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to retrieve historical weather trend data from Open-Meteo'
    return NextResponse.json(
      {
        error: message,
        isLive: false,
      },
      { status: 502 }
    )
  }
}
