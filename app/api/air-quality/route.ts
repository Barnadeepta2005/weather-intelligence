import { NextRequest, NextResponse } from 'next/server'
import { getAirQuality } from '@/lib/air-quality/service'
import { lastCpcbDiagnostic } from '@/lib/air-quality/india-cpcb'
import { DEFAULT_COORDINATES } from '@/lib/open-meteo'

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
    const aqiData = await getAirQuality({
      latitude,
      longitude,
      city: safeCity,
      country: safeCountry,
      timezone: safeTimezone,
    })

    const headers: Record<string, string> = {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }

    if (lastCpcbDiagnostic) {
      headers['x-diag-api-key-present'] = String(lastCpcbDiagnostic.apiKeyPresent)
      headers['x-diag-station'] = lastCpcbDiagnostic.stationAttempted || ''
      headers['x-diag-elapsed-ms'] = String(lastCpcbDiagnostic.elapsedMs)
      headers['x-diag-cpcb-status'] = lastCpcbDiagnostic.httpStatus !== null ? String(lastCpcbDiagnostic.httpStatus) : 'none'
      headers['x-diag-response-ok'] = lastCpcbDiagnostic.responseOk !== null ? String(lastCpcbDiagnostic.responseOk) : 'none'
      headers['x-diag-content-type'] = lastCpcbDiagnostic.contentType || 'none'
      headers['x-diag-body-length'] = lastCpcbDiagnostic.bodyLength !== null ? String(lastCpcbDiagnostic.bodyLength) : 'none'
      if (lastCpcbDiagnostic.errorName) {
        headers['x-diag-error-name'] = lastCpcbDiagnostic.errorName
      }
      if (lastCpcbDiagnostic.errorMessage) {
        headers['x-diag-error-message'] = lastCpcbDiagnostic.errorMessage
      }
    }

    return NextResponse.json(aqiData, {
      status: 200,
      headers,
    })
  } catch (err: any) {
    console.error('[API /api/air-quality] Error:', err?.message || err)
    return NextResponse.json(
      {
        index: null,
        standard: 'US',
        sourceType: 'ATMOSPHERIC_MODEL',
        sourceName: 'Air Quality Service Unavailable',
        level: 'UNAVAILABLE',
        pm25: null,
        pm10: null,
        o3: null,
        no2: null,
        timestamp: new Date().toISOString(),
        isFallback: true,
        error: err?.message || 'Failed to retrieve air quality data',
      },
      { status: 502 }
    )
  }
}
