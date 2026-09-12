import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side reverse geocode endpoint.
 * Isolates third-party API calls from client, prevents CORS/ad-blocker issues,
 * and gracefully falls back to a neutral "Current Location" label if resolution fails.
 * ₹0 cost, zero tracking, zero permanent storage of coordinates.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const latStr = searchParams.get('latitude') || searchParams.get('lat')
  const lonStr = searchParams.get('longitude') || searchParams.get('lon')

  const latitude = latStr ? parseFloat(latStr) : NaN
  const longitude = lonStr ? parseFloat(lonStr) : NaN

  if (isNaN(latitude) || isNaN(longitude)) {
    return NextResponse.json(
      { error: 'Valid latitude and longitude numbers are required' },
      { status: 400 }
    )
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json(
      { error: 'Coordinates out of range. Latitude must be between -90 and 90, longitude between -180 and 180.' },
      { status: 400 }
    )
  }

  const cacheHeaders = {
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }

  // Strategy 1: BigDataCloud free client-reverse geocode endpoint
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    const res = await fetch(bdcUrl, {
      signal: AbortSignal.timeout(4000),
      headers: { 'Accept': 'application/json' },
    })

    if (res.ok) {
      const data = await res.json()
      const cityName = data.city || data.locality || data.principalSubdivision
      if (cityName && data.countryName) {
        return NextResponse.json(
          {
            name: cityName,
            admin1: data.principalSubdivision || undefined,
            country: data.countryName,
          },
          { headers: cacheHeaders }
        )
      }
    }
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: OpenStreetMap Nominatim
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
    const res = await fetch(nomUrl, {
      signal: AbortSignal.timeout(4000),
      headers: {
        'User-Agent': 'WeatherIntelligenceApp/1.0',
        'Accept': 'application/json',
      },
    })

    if (res.ok) {
      const data = await res.json()
      const addr = data.address
      if (addr) {
        const cityName =
          addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.state_district
        if (cityName && addr.country) {
          return NextResponse.json(
            {
              name: cityName,
              admin1: addr.state || undefined,
              country: addr.country,
            },
            { headers: cacheHeaders }
          )
        }
      }
    }
  } catch {
    // Fallback below
  }

  // Graceful neutral label — never invent a fake city name
  return NextResponse.json(
    {
      name: 'Current Location',
      admin1: undefined,
      country: `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`,
    },
    { headers: cacheHeaders }
  )
}
