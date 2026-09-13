/**
 * Centralized WMO weather code mapping.
 *
 * Maps Open-Meteo WMO weather codes to:
 * - WeatherIconType (for the existing WeatherIcon component)
 * - Human-readable condition text (for the hero card)
 *
 * Reference: https://open-meteo.com/en/docs
 * WMO Weather interpretation codes (WW)
 */

import type { WeatherIconType } from './types'

interface WeatherCodeInfo {
  icon: WeatherIconType
  condition: string
}

const WEATHER_CODE_MAP: Record<number, WeatherCodeInfo> = {
  // Clear
  0:  { icon: 'sun',   condition: 'Clear sky' },
  1:  { icon: 'sun',   condition: 'Mainly clear' },
  2:  { icon: 'cloud', condition: 'Partly cloudy' },
  3:  { icon: 'cloud', condition: 'Overcast' },

  // Fog
  45: { icon: 'cloud', condition: 'Foggy' },
  48: { icon: 'cloud', condition: 'Depositing rime fog' },

  // Drizzle
  51: { icon: 'rain',  condition: 'Light drizzle' },
  53: { icon: 'rain',  condition: 'Moderate drizzle' },
  55: { icon: 'rain',  condition: 'Dense drizzle' },

  // Freezing drizzle
  56: { icon: 'rain',  condition: 'Light freezing drizzle' },
  57: { icon: 'rain',  condition: 'Dense freezing drizzle' },

  // Rain
  61: { icon: 'rain',  condition: 'Slight rain' },
  63: { icon: 'rain',  condition: 'Moderate rain' },
  65: { icon: 'rain',  condition: 'Heavy rain' },

  // Freezing rain
  66: { icon: 'rain',  condition: 'Light freezing rain' },
  67: { icon: 'rain',  condition: 'Heavy freezing rain' },

  // Snow
  71: { icon: 'cloud', condition: 'Slight snowfall' },
  73: { icon: 'cloud', condition: 'Moderate snowfall' },
  75: { icon: 'cloud', condition: 'Heavy snowfall' },
  77: { icon: 'cloud', condition: 'Snow grains' },

  // Showers
  80: { icon: 'rain',  condition: 'Slight rain showers' },
  81: { icon: 'rain',  condition: 'Moderate rain showers' },
  82: { icon: 'rain',  condition: 'Violent rain showers' },

  // Snow showers
  85: { icon: 'cloud', condition: 'Slight snow showers' },
  86: { icon: 'cloud', condition: 'Heavy snow showers' },

  // Thunderstorm
  95: { icon: 'storm', condition: 'Thunderstorm' },
  96: { icon: 'storm', condition: 'Thunderstorm with slight hail' },
  99: { icon: 'storm', condition: 'Thunderstorm with heavy hail' },
}

const FALLBACK: WeatherCodeInfo = { icon: 'cloud', condition: 'Unknown' }

/** Map a WMO weather code to icon type + readable condition */
export function mapWeatherCode(code: number | undefined | null): WeatherCodeInfo {
  if (code == null) return FALLBACK
  return WEATHER_CODE_MAP[code] ?? FALLBACK
}

// ── Wind direction ──────────────────────────────────────────────

const COMPASS_DIRECTIONS = [
  'North', 'North east', 'East', 'South east',
  'South', 'South west', 'West', 'North west',
] as const

/** Convert wind direction degrees to a compass string */
export function degreesToCompass(degrees: number | undefined | null): string {
  if (degrees == null) return 'N/A'
  const index = Math.round(degrees / 45) % 8
  return COMPASS_DIRECTIONS[index]
}

// ── UV classification ───────────────────────────────────────────

interface UVClassification {
  level: string
  advice: string
}

export function classifyUV(index: number): UVClassification {
  if (index <= 2) return { level: 'LOW', advice: 'No protection needed. Enjoy the outdoors safely.' }
  if (index <= 5) return { level: 'MODERATE', advice: 'Wear sunscreen. Seek shade during midday hours.' }
  if (index <= 7) return { level: 'HIGH', advice: 'Protection recommended. Limit direct sun exposure between 11 AM — 3 PM.' }
  if (index <= 10) return { level: 'VERY HIGH', advice: 'Extra protection needed. Avoid sun exposure between 10 AM — 4 PM.' }
  return { level: 'EXTREME', advice: 'Stay indoors during midday. Maximum sun protection essential.' }
}

// ── AQI classification ──────────────────────────────────────────

/**
 * US EPA AQI standard classification (0–500 scale).
 * Reference: EPA Air Quality Index guidelines.
 */
export function classifyUSAQI(index: number): string {
  if (index <= 50) return 'GOOD'
  if (index <= 100) return 'MODERATE'
  if (index <= 150) return 'UNHEALTHY (SENSITIVE)'
  if (index <= 200) return 'UNHEALTHY'
  if (index <= 300) return 'VERY UNHEALTHY'
  return 'HAZARDOUS'
}

/**
 * European Air Quality Index standard classification (0–100+ scale).
 * Reference: European Environment Agency (EEA).
 */
export function classifyEuropeanAQI(index: number): string {
  if (index <= 20) return 'GOOD'
  if (index <= 40) return 'FAIR'
  if (index <= 60) return 'MODERATE'
  if (index <= 80) return 'POOR'
  if (index <= 100) return 'VERY POOR'
  return 'EXTREMELY POOR'
}

export function classifyAQI(index: number, standard: 'US' | 'EUROPEAN' = 'US'): string {
  return standard === 'US' ? classifyUSAQI(index) : classifyEuropeanAQI(index)
}

// ── Humidity classification ─────────────────────────────────────

export function classifyHumidity(humidity: number): string {
  if (humidity <= 30) return 'Low'
  if (humidity <= 60) return 'Comfortable'
  if (humidity <= 80) return 'High'
  return 'Very high'
}

// ── Visibility classification ───────────────────────────────────

export function classifyVisibility(km: number): string {
  if (km >= 10) return 'Excellent'
  if (km >= 5) return 'Good'
  if (km >= 2) return 'Moderate'
  if (km >= 1) return 'Poor'
  return 'Very poor'
}

// ── Pressure tendency ───────────────────────────────────────────

export function classifyPressure(hPa: number): string {
  if (hPa >= 1020) return 'High'
  if (hPa >= 1000) return 'Steady'
  return 'Low'
}

// ── Feels-like classification ───────────────────────────────────

export function classifyFeelsLike(feelsLike: number, actual: number): string {
  const diff = feelsLike - actual
  if (diff >= 4) return 'Humid conditions'
  if (diff >= 1) return 'Slightly humid'
  if (diff <= -4) return 'Wind chill'
  if (diff <= -1) return 'Feels cooler'
  return 'Comfortable'
}

// ── Season note ─────────────────────────────────────────────────

/** Generate a simple season note based on month and latitude */
export function getSeasonNote(month: number, latitude: number): string {
  const isNorthern = latitude >= 0
  if (isNorthern) {
    if (month >= 6 && month <= 9) return 'MONSOON SEASON'
    if (month >= 10 && month <= 11) return 'POST-MONSOON'
    if (month >= 12 || month <= 2) return 'WINTER SEASON'
    return 'SUMMER SEASON'
  }
  // Southern hemisphere (simplified)
  if (month >= 12 || month <= 2) return 'SUMMER SEASON'
  if (month >= 3 && month <= 5) return 'AUTUMN SEASON'
  if (month >= 6 && month <= 8) return 'WINTER SEASON'
  return 'SPRING SEASON'
}

// ── Time formatting ─────────────────────────────────────────────

/** Format ISO8601 time string to "HH:MM" (24h) */
export function formatHour(isoTime: string): string {
  const date = new Date(isoTime)
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Format ISO8601 time string to "h:mm AM/PM" */
export function formatTime12h(isoTime: string): string {
  const date = new Date(isoTime)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** Format ISO8601 date string to "DAY / DD MMM YYYY" */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const dd = date.getDate()
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const year = date.getFullYear()
  return `${day} / ${dd} ${month} ${year}`
}

/** Get 3-letter day abbreviation from ISO date */
export function formatDayShort(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

/** Get current time as "HH:MM" for a timezone */
export function formatLocalTime(timezone: string): string {
  try {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    })
  } catch {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
}

/** Format ISO8601 date to full readable format e.g. "Sunday, 13 Sep 2026" */
export function formatFullDate(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return isoDate
  }
}

/** Format ISO8601 time to readable date and time e.g. "Sun, 13 Sep • 2:00 PM" */
export function formatFullDateTime(isoTime: string): string {
  try {
    const date = new Date(isoTime)
    const dayStr = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${dayStr} • ${timeStr}`
  } catch {
    return isoTime
  }
}

// ── Temperature conversion ──────────────────────────────────────

/** Convert Celsius to Fahrenheit */
export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32)
}
