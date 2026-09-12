import { NextRequest, NextResponse } from 'next/server'
import { getWeatherData, DEFAULT_COORDINATES } from '@/lib/open-meteo'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const latStr = searchParams.get('latitude') || searchParams.get('lat')
  const lonStr = searchParams.get('longitude') || searchParams.get('lon')

  const latitude = latStr ? parseFloat(latStr) : DEFAULT_COORDINATES.latitude
  const longitude = lonStr ? parseFloat(lonStr) : DEFAULT_COORDINATES.longitude
  const city = searchParams.get('city') || DEFAULT_COORDINATES.city
  const country = searchParams.get('country') || DEFAULT_COORDINATES.country
  const timezone = searchParams.get('timezone') || DEFAULT_COORDINATES.timezone

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

  const safeCity = city.slice(0, 100)
  const safeCountry = country.slice(0, 100)
  const safeTimezone = timezone.slice(0, 50)

  try {
    const data = await getWeatherData(latitude, longitude, safeCity, safeCountry, safeTimezone)
    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve weather data from Open-Meteo'
    return NextResponse.json(
      {
        error: message,
        isLive: false,
      },
      { status: 502 }
    )
  }
}
