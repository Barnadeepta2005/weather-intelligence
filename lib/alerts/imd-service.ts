/**
 * IMD Weather Alerts Service
 *
 * Integrates official public feeds from the India Meteorological Department (IMD):
 * 1. District Nowcast (immediate 3-hour high-resolution severe weather warnings)
 * 2. District-wise Warnings (multi-hazard daily outlook)
 *
 * Adheres strictly to ₹0 recurring-cost requirement, uses official government data,
 * filters expired warnings, maps official severity, and caches in-memory for 3 minutes.
 */

import type {
  AlertSeverity,
  AlertsResponse,
  DistrictInfo,
  IMDDistrictMapping,
  WeatherAlert,
} from './types'
import imdDistrictsData from './imd-districts.json' with { type: 'json' }

const districts: IMDDistrictMapping[] = imdDistrictsData as IMDDistrictMapping[]

// In-memory cache for national warning data (3 minutes TTL)
interface CacheEntry {
  timestamp: number
  alertsByDistrictId: Map<string, WeatherAlert[]>
}

let memoryCache: CacheEntry | null = null
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutes

const IMD_WARNING_URL = 'https://mausam.imd.gov.in/responsive/districtWiseWarning.php'
const IMD_NOWCAST_URL = 'https://mausam.imd.gov.in/responsive/districtWiseNowcast.php'
const OFFICIAL_SOURCE_URL = 'https://mausam.imd.gov.in'

const CITY_ALIASES: Record<string, string> = {
  BANGALORE: 'BENGALURU URBAN',
  BENGALURU: 'BENGALURU URBAN',
  MUMBAI: 'MUMBAI CITY',
  DELHI: 'NEW DELHI',
  'NEW DELHI': 'NEW DELHI',
  CALCUTTA: 'KOLKATA',
  MADRAS: 'CHENNAI',
  BOMBAY: 'MUMBAI CITY',
  GURGAON: 'GURUGRAM',
  AHMEDABAD: 'AHMADABAD',
  BARODA: 'VADODARA',
  COCHIN: 'ERNAKULAM',
  TRIVANDRUM: 'THIRUVANANTHAPURAM',
  PONDICHERRY: 'PUDUCHERRY',
}

function distanceSquared(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat1 - lat2
  const dLon = lon1 - lon2
  return dLat * dLat + dLon * dLon
}

/**
 * Resolve arbitrary coordinates & locality to the official IMD District.
 */
export function resolveDistrict(
  lat: number,
  lon: number,
  city = '',
  admin1 = ''
): IMDDistrictMapping | null {
  const normCity = city.trim().toUpperCase().replace(/\s+(CITY|DISTRICT)$/i, '')
  const aliasCity = CITY_ALIASES[normCity] || normCity
  const normState = admin1.trim().toUpperCase()

  // 1. Exact match on city & state
  if (normCity) {
    const exactMatches = districts.filter((d) => {
      const matchName = d.name === aliasCity || d.name === normCity
      if (!matchName) return false
      if (normState && d.state) {
        return d.state.includes(normState) || normState.includes(d.state)
      }
      return true
    })

    if (exactMatches.length > 0) {
      return exactMatches[0]
    }

    // Partial city name match
    const partialMatches = districts.filter((d) => {
      const pMatch = d.name.includes(aliasCity) || aliasCity.includes(d.name)
      if (!pMatch) return false
      if (normState && d.state) {
        return d.state.includes(normState) || normState.includes(d.state)
      }
      return true
    })

    if (partialMatches.length > 0) {
      return partialMatches[0]
    }
  }

  // 2. Spatial lookup by coordinate
  if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
    // Check bounding box with small epsilon (0.02 deg ~ 2 km)
    const candidates = districts.filter((d) => {
      const [minLon, minLat, maxLon, maxLat] = d.bbox
      return (
        lon >= minLon - 0.02 &&
        lon <= maxLon + 0.02 &&
        lat >= minLat - 0.02 &&
        lat <= maxLat + 0.02
      )
    })

    if (candidates.length === 1) {
      return candidates[0]
    }

    if (candidates.length > 1) {
      // Pick closest centroid among candidates
      let closest = candidates[0]
      let minD = distanceSquared(lat, lon, candidates[0].lat, candidates[0].lon)
      for (let i = 1; i < candidates.length; i++) {
        const d = distanceSquared(lat, lon, candidates[i].lat, candidates[i].lon)
        if (d < minD) {
          minD = d
          closest = candidates[i]
        }
      }
      return closest
    }

    // Fallback: closest centroid among all 754 districts
    let closest = districts[0]
    let minD = distanceSquared(lat, lon, districts[0].lat, districts[0].lon)
    for (let i = 1; i < districts.length; i++) {
      const d = distanceSquared(lat, lon, districts[i].lat, districts[i].lon)
      if (d < minD) {
        minD = d
        closest = districts[i]
      }
    }
    return closest
  }

  return null
}

/**
 * Map IMD color to normalized UI severity.
 */
function mapColorToSeverity(hexColor?: string): AlertSeverity | null {
  if (!hexColor) return null
  const c = hexColor.trim().toUpperCase()

  // Green: No warning
  if (c === '#008000' || c === '#7CFC00' || c === 'GREEN') {
    return 'INFO'
  }
  // Yellow: Watch / Be Updated
  if (c === '#FFFF00' || c === 'YELLOW') {
    return 'MODERATE'
  }
  // Orange: Alert / Be Prepared
  if (c === '#FFA500' || c === 'ORANGE') {
    return 'SEVERE'
  }
  // Red: Warning / Take Action
  if (c === '#FF0000' || c === 'RED') {
    return 'EXTREME'
  }

  return null
}

/**
 * Parse validity timestamps and test for expiry.
 */
function parseNowcastExpiry(
  issueStr = '',
  validStr = ''
): {
  isExpired: boolean
  issuedAt?: string
  endTime?: string
  startTime?: string
} {
  const mIssue = issueStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2})(\d{2})/)
  if (!mIssue) {
    return { isExpired: false, issuedAt: issueStr, endTime: validStr }
  }

  const [, y, mo, d, h, mi] = mIssue
  const issueDate = new Date(`${y}-${mo}-${d}T${h}:${mi}:00+05:30`)

  const mValid = validStr.match(/(\d{2})(\d{2})/)
  if (!mValid) {
    return { isExpired: false, issuedAt: `${y}-${mo}-${d} ${h}:${mi} IST`, endTime: validStr }
  }

  const [, vH, vM] = mValid
  let validDate = new Date(`${y}-${mo}-${d}T${vH}:${vM}:00+05:30`)

  // Midnight rollover
  if (validDate.getTime() < issueDate.getTime()) {
    validDate = new Date(validDate.getTime() + 24 * 60 * 60 * 1000)
  }

  const now = new Date()
  const isExpired = now.getTime() > validDate.getTime()

  return {
    isExpired,
    issuedAt: `${y}-${mo}-${d} ${h}:${mi} IST`,
    endTime: `${vH}:${vM} IST`,
    startTime: issueDate.toISOString(),
  }
}

/**
 * Clean and normalize text from raw HTML snippets.
 */
function cleanHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' • ')
    .replace(/<\/p>\s*<p>/gi, ' • ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Derive a concise title from meteorological text.
 */
function deriveAlertTitle(desc: string, severity: AlertSeverity): string {
  const upper = desc.toUpperCase()
  if (upper.includes('THUNDERSTORM') && upper.includes('LIGHTNING')) {
    return 'THUNDERSTORM & LIGHTNING'
  }
  if (upper.includes('EXTREMELY HEAVY RAIN')) {
    return 'EXTREMELY HEAVY RAINFALL'
  }
  if (upper.includes('VERY HEAVY RAIN')) {
    return 'VERY HEAVY RAINFALL'
  }
  if (upper.includes('HEAVY RAIN')) {
    return 'HEAVY RAINFALL'
  }
  if (upper.includes('SQUALL') || upper.includes('WIND')) {
    return 'HIGH SURFACE WINDS'
  }
  if (upper.includes('HAIL')) {
    return 'HAILSTORM'
  }
  if (upper.includes('DUST')) {
    return 'DUST STORM'
  }
  if (upper.includes('HEAT WAVE')) {
    return 'HEAT WAVE'
  }
  if (upper.includes('COLD WAVE')) {
    return 'COLD WAVE'
  }
  if (upper.includes('FOG')) {
    return 'DENSE FOG'
  }
  return severity === 'EXTREME'
    ? 'SEVERE WEATHER WARNING'
    : severity === 'SEVERE'
    ? 'WEATHER ALERT'
    : 'WEATHER WATCH'
}

/**
 * Fetch and parse both public IMD feeds into a unified map keyed by district ID.
 */
async function fetchAndParseNationalAlerts(): Promise<Map<string, WeatherAlert[]>> {
  const alertsMap = new Map<string, WeatherAlert[]>()

  // Fetch both feeds in parallel with 6s timeout
  const [warningRes, nowcastRes] = await Promise.allSettled([
    fetch(IMD_WARNING_URL, {
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'WeatherIntelligenceApp/1.0 (Government Weather Integration)',
        Accept: 'text/html,application/xhtml+xml',
      },
    }),
    fetch(IMD_NOWCAST_URL, {
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'WeatherIntelligenceApp/1.0 (Government Weather Integration)',
        Accept: 'text/html,application/xhtml+xml',
      },
    }),
  ])

  // 1. Process Nowcasts (Highest immediate precedence)
  if (nowcastRes.status === 'fulfilled' && nowcastRes.value.ok) {
    try {
      const nowcastHtml = await nowcastRes.value.text()
      const match = nowcastHtml.match(/"areas":\s*(\[\s*\{[\s\S]*?\}\s*\])/)
      if (match) {
        const rawAreas = JSON.parse(match[1])
        for (const item of rawAreas) {
          const districtId = String(item.id || '').trim()
          const colorHex = item.color?.trim().toUpperCase()
          const severity = mapColorToSeverity(colorHex)

          // Skip green or invalid severity
          if (!severity || severity === 'INFO') continue

          const infoHtml = item.info || item.balloonText || ''

          // Extract issue and validity times
          const mIssue = infoHtml.match(/(?:Time of issue|Date of issue)<\/b>:?\s*(?:<p>)?([^<]+)/i)
          const mValid = infoHtml.match(/(?:Valid upto|Valid until)<\/b>:?\s*(?:<p>)?([^<]+)/i)
          const issueStr = mIssue ? mIssue[1].replace(/<[^>]+>/g, '').trim() : ''
          const validStr = mValid ? mValid[1].replace(/<[^>]+>/g, '').trim() : ''

          const { isExpired, issuedAt, endTime, startTime } = parseNowcastExpiry(issueStr, validStr)

          // Strict check: Never display or cache expired warnings
          if (isExpired) continue

          // Extract pure meteorological description
          const descMatch = infoHtml.match(/<div>([\s\S]*?)<\/div>/i)
          const rawDesc = descMatch ? descMatch[1] : infoHtml
          const cleanDesc = cleanHtmlText(rawDesc)

          if (!cleanDesc || cleanDesc.toLowerCase().includes('no warning')) continue

          const title = deriveAlertTitle(cleanDesc, severity)
          const districtName = item.title?.trim().toUpperCase() || 'DISTRICT'

          const alert: WeatherAlert = {
            id: `IMD-NOWCAST-${districtId}-${issueStr.replace(/[^0-9]/g, '') || Date.now()}`,
            title,
            severity,
            source: 'IMD',
            sourceType: 'OFFICIAL',
            area: districtName,
            districtId,
            description: cleanDesc,
            issuedAt,
            endTime,
            startTime,
            colorHex,
            sourceUrl: OFFICIAL_SOURCE_URL,
          }

          const existing = alertsMap.get(districtId) || []
          existing.push(alert)
          alertsMap.set(districtId, existing)
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn('[IMD Alerts] Failed to parse Nowcast feed:', errMsg)
    }
  }

  // 2. Process Daily Warnings (Day 1 multi-hazard outlook)
  if (warningRes.status === 'fulfilled' && warningRes.value.ok) {
    try {
      const warningHtml = await warningRes.value.text()
      const match = warningHtml.match(/"areas":\s*(\[\s*\{[\s\S]*?\}\s*\])/)
      if (match) {
        const rawAreas = JSON.parse(match[1])
        for (const item of rawAreas) {
          const districtId = String(item.id || '').trim()
          const colorHex = item.color?.trim().toUpperCase()
          const severity = mapColorToSeverity(colorHex)

          if (!severity || severity === 'INFO') continue

          const balloon = item.balloonText || ''
          const cleanDesc = cleanHtmlText(balloon)

          // Extract date
          const dateMatch = balloon.match(/Date:\s*(\d{4}-\d{2}-\d{2})/i)
          const validDate = dateMatch ? dateMatch[1] : undefined

          // Check if already covered by an active nowcast for this district
          const existing = alertsMap.get(districtId) || []
          const hasNowcast = existing.length > 0

          if (!hasNowcast && cleanDesc && !cleanDesc.toLowerCase().includes('no warning')) {
            const title = deriveAlertTitle(cleanDesc, severity)
            const districtName = item.title?.trim().toUpperCase() || 'DISTRICT'

            const alert: WeatherAlert = {
              id: `IMD-WARN-${districtId}-${validDate || Date.now()}`,
              title,
              severity,
              source: 'IMD',
              sourceType: 'OFFICIAL',
              area: districtName,
              districtId,
              description: cleanDesc,
              validDate,
              colorHex,
              sourceUrl: OFFICIAL_SOURCE_URL,
            }
            existing.push(alert)
            alertsMap.set(districtId, existing)
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn('[IMD Alerts] Failed to parse Daily Warning feed:', errMsg)
    }
  }

  return alertsMap
}

/**
 * Get active alerts for the specified location.
 * Uses 3-minute in-memory national cache.
 * Fail-safe: Returns clean empty response on upstream failure; never throws.
 */
export async function getAlertsForLocation(
  latitude: number,
  longitude: number,
  city = '',
  admin1 = ''
): Promise<AlertsResponse> {
  const district = resolveDistrict(latitude, longitude, city, admin1)

  const districtInfo: DistrictInfo | undefined = district
    ? { id: district.id, name: district.name, state: district.state }
    : undefined

  const now = Date.now()

  // Use memory cache if fresh
  let alertsByDistrict: Map<string, WeatherAlert[]> | null = null
  if (memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    alertsByDistrict = memoryCache.alertsByDistrictId
  } else {
    try {
      alertsByDistrict = await fetchAndParseNationalAlerts()
      memoryCache = {
        timestamp: now,
        alertsByDistrictId: alertsByDistrict,
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn('[IMD Alerts Service] Upstream fetch error:', errMsg)
      // Fallback to existing stale cache if available
      if (memoryCache) {
        alertsByDistrict = memoryCache.alertsByDistrictId
      }
    }
  }

  if (!alertsByDistrict || !district) {
    return {
      hasActiveAlerts: false,
      district: districtInfo,
      alerts: [],
      lastUpdated: new Date().toISOString(),
      attribution: 'India Meteorological Department (IMD)',
      isLive: Boolean(alertsByDistrict),
    }
  }

  const rawAlerts = alertsByDistrict.get(district.id) || []

  // Ensure district area label is populated with human-readable name & state
  const areaLabel = `${district.name}, ${district.state}`
  const enrichedAlerts = rawAlerts.map((a) => ({
    ...a,
    area: areaLabel,
  }))

  return {
    hasActiveAlerts: enrichedAlerts.length > 0,
    district: districtInfo,
    alerts: enrichedAlerts,
    lastUpdated: new Date().toISOString(),
    attribution: 'India Meteorological Department (IMD)',
    isLive: true,
  }
}
