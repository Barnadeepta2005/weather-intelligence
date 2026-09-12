/**
 * India Air Quality Ground Monitoring Provider (CPCB CAAQMS).
 *
 * Sourced directly from the official Central Pollution Control Board (CPCB)
 * Continuous Ambient Air Quality Monitoring Station dataset via Data.gov.in (OGD India).
 *
 * Features:
 * - Server-side in-memory caching with 20-minute TTL to respect rate limits.
 * - 4-second timeout protection.
 * - Strict minimum data validation (rejects insufficient or corrupt sensor reports).
 * - Zero external leaks of API keys.
 */

import type { UnifiedAirQuality } from '@/lib/types'
import { calculateCPCBAQI, classifyCPCB, type PollutantReading } from './cpcb-calculator'

interface CacheEntry {
  data: UnifiedAirQuality
  expiresAt: number
}

// In-memory cache for CPCB station air quality (TTL: 20 minutes)
const stationCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 20 * 60 * 1000

const DATA_GOV_RESOURCE_ID = '3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69'

function getApiKey(): string | null {
  return process.env.DATA_GOV_IN_API_KEY?.trim() || null
}

/**
 * Format Data.gov.in DD-MM-YYYY HH:mm:ss string to ISO string.
 */
function parseLastUpdateToIso(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString()
  try {
    // Format: "12-09-2026 13:00:00"
    const parts = dateStr.trim().split(' ')
    if (parts.length === 2) {
      const [d, m, y] = parts[0].split('-')
      const time = parts[1]
      return `${y}-${m}-${d}T${time}`
    }
  } catch {
    // Ignore fallback
  }
  return dateStr
}

export interface CpcbDiagnosticInfo {
  apiKeyPresent: boolean
  stationAttempted: string
  startTimeIso: string
  elapsedMs: number
  httpStatus: number | null
  responseOk: boolean | null
  contentType: string | null
  bodyLength: number | null
  errorName: string | null
  errorMessage: string | null
}

export let lastCpcbDiagnostic: CpcbDiagnosticInfo | null = null

/**
 * Fetch official ground monitoring air quality for a specific CPCB station.
 * Returns null if the station data is corrupt, unavailable, or fails the CPCB minimum data criteria.
 */
export async function fetchCPCBStationAQI(stationName: string): Promise<UnifiedAirQuality | null> {
  const cacheKey = stationName.trim().toLowerCase()
  const cached = stationCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const startTime = Date.now()
  const startTimeIso = new Date(startTime).toISOString()
  const hasKey = Boolean(process.env.DATA_GOV_IN_API_KEY && process.env.DATA_GOV_IN_API_KEY.trim().length > 0)

  console.log(`[CPCB Diag] Station attempt: "${stationName}", DATA_GOV_IN_API_KEY present: ${hasKey}, startTime: ${startTimeIso}`)

  if (!hasKey) {
    console.warn(`[CPCB Diag] Station "${stationName}" aborted: process.env.DATA_GOV_IN_API_KEY is missing or empty.`)
    lastCpcbDiagnostic = {
      apiKeyPresent: false,
      stationAttempted: stationName,
      startTimeIso,
      elapsedMs: Date.now() - startTime,
      httpStatus: null,
      responseOk: null,
      contentType: null,
      bodyLength: null,
      errorName: 'MissingApiKey',
      errorMessage: 'process.env.DATA_GOV_IN_API_KEY is missing or empty in runtime environment',
    }
    return null
  }

  const apiKey = getApiKey()!
  const endpoint =
    `https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}` +
    `?api-key=${apiKey}&format=json&limit=10&filters[station]=${encodeURIComponent(stationName)}`

  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(7000), // 7-second resilient server-side timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Weather-App-CPCB-Client/1.0',
      },
    })

    const elapsedMs = Date.now() - startTime
    const contentType = res.headers.get('content-type')
    const rawText = await res.text()
    const bodyLength = rawText.length

    console.log(`[CPCB Diag] Station "${stationName}": HTTP ${res.status}, ok: ${res.ok}, elapsed: ${elapsedMs}ms, contentType: "${contentType}", bodyLength: ${bodyLength}`)

    lastCpcbDiagnostic = {
      apiKeyPresent: true,
      stationAttempted: stationName,
      startTimeIso,
      elapsedMs,
      httpStatus: res.status,
      responseOk: res.ok,
      contentType,
      bodyLength,
      errorName: res.ok ? null : `HttpError${res.status}`,
      errorMessage: res.ok ? null : `HTTP ${res.status} ${res.statusText || ''}`.trim(),
    }

    if (!res.ok) {
      if (res.status === 429) {
        console.warn(`[CPCB Provider] Data.gov.in rate limit encountered for station "${stationName}".`)
      } else {
        console.warn(`[CPCB Provider] Data.gov.in returned HTTP ${res.status} for station "${stationName}".`)
      }
      return null
    }

    let payload: any = null
    try {
      payload = JSON.parse(rawText)
    } catch (parseErr: any) {
      console.warn(`[CPCB Diag] Failed to parse JSON response for station "${stationName}": ${parseErr.message}`)
      return null
    }

    const records = payload?.records

    if (!Array.isArray(records) || records.length === 0) {
      console.warn(`[CPCB Diag] Station "${stationName}" returned 0 records.`)
      return null
    }

    // Map records to pollutant readings, specific values, and check for direct CPCB AQI
    const readings: PollutantReading[] = []
    let pm25: number | null = null
    let pm10: number | null = null
    let o3: number | null = null
    let no2: number | null = null
    let lastUpdate: string | null = null
    let directAqi: number | null = null

    for (const r of records) {
      const rawVal = r.avg_value
      const pid = (r.pollutant_id || '').toUpperCase().trim()

      let parsedVal: number | null = null
      if (rawVal !== null && rawVal !== undefined && rawVal !== 'NA' && rawVal !== '') {
        const num = parseFloat(String(rawVal).trim())
        if (!isNaN(num) && num > -900) {
          parsedVal = Math.round(num)
        }
      }

      // Check if this record reports a direct CPCB AQI value
      if (pid === 'AQI' || pid === 'NAQI' || pid === 'AIR QUALITY INDEX' || pid === 'INDEX') {
        if (parsedVal !== null && parsedVal >= 0 && parsedVal <= 500) {
          directAqi = parsedVal
        }
      } else if (r.aqi !== undefined && r.aqi !== null && r.aqi !== 'NA' && r.aqi !== '') {
        const num = parseFloat(String(r.aqi).trim())
        if (!isNaN(num) && num >= 0 && num <= 500) {
          directAqi = Math.round(num)
        }
      }

      readings.push({
        pollutantId: pid,
        avgValue: parsedVal,
      })

      if (parsedVal !== null) {
        if (pid === 'PM2.5' || pid === 'PM25' || pid === 'PM2_5') pm25 = parsedVal
        if (pid === 'PM10') pm10 = parsedVal
        if (pid === 'OZONE' || pid === 'O3') o3 = parsedVal
        if (pid === 'NO2' || pid === 'NITROGEN_DIOXIDE') no2 = parsedVal
      }

      if (r.last_update && !lastUpdate) {
        lastUpdate = parseLastUpdateToIso(r.last_update)
      }
    }

    let finalAqi: number
    let finalCategory: string
    let finalProminent: string | undefined

    if (directAqi !== null) {
      // PRODUCT RULE: When a valid direct CPCB AQI value is available, use it directly.
      finalAqi = directAqi
      finalCategory = classifyCPCB(directAqi)
    } else {
      // Otherwise, calculate NAQI using official CPCB protocol from monitored readings
      const calcResult = calculateCPCBAQI(readings)

      if (!calcResult.isValid) {
        console.warn(`[CPCB Provider] Station "${stationName}" rejected: ${calcResult.validationError}`)
        return null
      }

      finalAqi = calcResult.aqi
      finalCategory = calcResult.category
      finalProminent = calcResult.prominentPollutant
    }

    const unified: UnifiedAirQuality = {
      index: finalAqi,
      standard: 'CPCB',
      sourceType: 'GROUND_STATION',
      sourceName: `CPCB CAAQMS — ${stationName}`,
      level: finalCategory,
      prominentPollutant: finalProminent,
      pm25,
      pm10,
      o3,
      no2,
      timestamp: lastUpdate || new Date().toISOString(),
      isFallback: false,
    }

    // Save to memory cache
    stationCache.set(cacheKey, {
      data: unified,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return unified
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime
    console.warn(`[CPCB Diag] Station "${stationName}" caught error: name=${err?.name || 'Error'}, message=${err?.message || String(err)}, elapsed=${elapsedMs}ms`)
    lastCpcbDiagnostic = {
      apiKeyPresent: hasKey,
      stationAttempted: stationName,
      startTimeIso,
      elapsedMs,
      httpStatus: null,
      responseOk: null,
      contentType: null,
      bodyLength: null,
      errorName: err?.name || 'Error',
      errorMessage: err?.message || String(err),
    }
    return null
  }
}
