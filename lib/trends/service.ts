/**
 * Weather Trends & Historical Comparison Service (Phase 4)
 * 
 * Fetches historical observations & model analysis from Open-Meteo's API
 * using `past_days` (7, 14, or 30 days) and computes deterministic
 * comparison deltas and smart trend summaries.
 * 
 * Strict ₹0 recurring cost. No LLM or external AI dependencies.
 */

import type {
  TrendRange,
  WeatherTrendsData,
  HistoricalHourlyPoint,
  HistoricalDailyPoint,
  TodayComparison,
  MetricComparison,
  TrendSummary,
} from './types'
import { fetchWithTimeout } from '../open-meteo'

interface CacheEntry {
  data: WeatherTrendsData
  timestamp: number
}

// Bounded in-memory LRU cache (max 50 entries, 30-minute TTL)
const trendsCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const MAX_CACHE_ENTRIES = 50

function getCacheKey(lat: number, lon: number, range: TrendRange, tz: string): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}_${range}_${tz}`
}

function cleanExpiredCache() {
  const now = Date.now()
  for (const [key, entry] of trendsCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      trendsCache.delete(key)
    }
  }
}

/**
 * Format ISO time into 24h hour label "HH:MM"
 */
function formatHourLabel(isoString: string): string {
  try {
    const d = new Date(isoString)
    const hours = d.getHours().toString().padStart(2, '0')
    return `${hours}:00`
  } catch {
    return isoString.slice(11, 16) || '00:00'
  }
}

/**
 * Format "YYYY-MM-DD" into short day label, e.g. "Mon 08"
 */
function formatDayLabel(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(Date.UTC(year, month - 1, day))
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
    return `${dayName} ${day.toString().padStart(2, '0')}`
  } catch {
    return dateStr.slice(5)
  }
}

/**
 * Fetch and normalize Weather Trends data
 */
export async function getWeatherTrends(
  latitude: number,
  longitude: number,
  timezone = 'auto',
  range: TrendRange = '7d'
): Promise<WeatherTrendsData> {
  const cacheKey = getCacheKey(latitude, longitude, range, timezone)
  const cached = trendsCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  const pastDays = range === '30d' ? 30 : range === '14d' ? 14 : 7

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&past_days=${pastDays}&forecast_days=1` +
    `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,uv_index_max` +
    `&timezone=${encodeURIComponent(timezone || 'auto')}`

  const res = await fetchWithTimeout(url, 9000)
  if (!res.ok) {
    throw new Error(`Open-Meteo Historical/Forecast API error: HTTP ${res.status}`)
  }

  const json = await res.json()
  if (!json || !json.daily || !json.hourly) {
    throw new Error('Malformed JSON received from Open-Meteo API')
  }

  const { hourly, daily } = json

  // 1. Process 24-Hour Timeline
  // We want the last 24 completed/current hours up to the current timestamp
  const nowIso = new Date().toISOString()
  const rawHourlyTimes: string[] = hourly.time || []
  const totalHourly = rawHourlyTimes.length

  // Find index closest to current hour
  let currentIdx = -1
  const nowMs = Date.now()
  let minDiff = Infinity
  for (let i = 0; i < totalHourly; i++) {
    const diff = Math.abs(new Date(rawHourlyTimes[i]).getTime() - nowMs)
    if (diff < minDiff) {
      minDiff = diff
      currentIdx = i
    }
  }
  if (currentIdx === -1) currentIdx = Math.max(0, totalHourly - 1)

  // Take the 24 hours ending at or just around currentIdx
  const startIdx = Math.max(0, currentIdx - 23)
  const endIdx = Math.min(totalHourly, currentIdx + 1)
  const hourlySliceTimes = rawHourlyTimes.slice(startIdx, endIdx)

  const hourly24h: HistoricalHourlyPoint[] = hourlySliceTimes.map((timeStr, offset) => {
    const realIdx = startIdx + offset
    const timeMs = new Date(timeStr).getTime()
    const isCurrent = realIdx === currentIdx
    const isPast = timeMs <= nowMs && !isCurrent

    return {
      time: timeStr,
      hourLabel: formatHourLabel(timeStr),
      temperature: Number(hourly.temperature_2m?.[realIdx] ?? 0),
      apparentTemperature: Number(hourly.apparent_temperature?.[realIdx] ?? 0),
      humidity: Number(hourly.relative_humidity_2m?.[realIdx] ?? 0),
      windSpeed: Number(hourly.wind_speed_10m?.[realIdx] ?? 0),
      precipitation: Number(hourly.precipitation?.[realIdx] ?? 0),
      isPast,
      isCurrent,
    }
  })

  // 2. Process Daily Trend Points
  const rawDailyTimes: string[] = daily.time || []
  const dailyPoints: HistoricalDailyPoint[] = rawDailyTimes.map((dateStr, idx) => {
    const isToday = idx === rawDailyTimes.length - 1
    return {
      date: dateStr,
      dayLabel: formatDayLabel(dateStr),
      tempMax: Number(daily.temperature_2m_max?.[idx] ?? 0),
      tempMin: Number(daily.temperature_2m_min?.[idx] ?? 0),
      precipitationSum: Number(daily.precipitation_sum?.[idx] ?? 0),
      windSpeedMax: Number(daily.wind_speed_10m_max?.[idx] ?? 0),
      uvIndexMax: Number(daily.uv_index_max?.[idx] ?? 0),
      isToday,
    }
  })

  // 3. Deterministic "Today vs Recent" Comparison
  // Baseline = all days except today
  const baselineDays = Math.max(1, dailyPoints.length - 1)
  const baselineList = dailyPoints.slice(0, baselineDays)
  const todayPoint = dailyPoints[dailyPoints.length - 1] || dailyPoints[0]

  // A. Temperature comparison (mean of (high+low)/2 across baseline vs today's mean)
  const baselineTempSum = baselineList.reduce((acc, d) => acc + (d.tempMax + d.tempMin) / 2, 0)
  const baselineTempAvg = baselineTempSum / baselineDays
  const todayTempAvg = (todayPoint.tempMax + todayPoint.tempMin) / 2
  const tempDiff = Number((todayTempAvg - baselineTempAvg).toFixed(1))

  let tempStatus: MetricComparison['status'] = 'same'
  let tempText = 'ABOUT THE SAME'
  if (tempDiff >= 3.0) {
    tempStatus = 'warmer'
    tempText = `+${tempDiff}° MUCH WARMER`
  } else if (tempDiff >= 1.0) {
    tempStatus = 'warmer'
    tempText = `+${tempDiff}° SLIGHTLY WARMER`
  } else if (tempDiff <= -3.0) {
    tempStatus = 'cooler'
    tempText = `${tempDiff}° MUCH COOLER`
  } else if (tempDiff <= -1.0) {
    tempStatus = 'cooler'
    tempText = `${tempDiff}° SLIGHTLY COOLER`
  }

  // B. Rain comparison (daily average vs today's precipitation sum)
  const baselineRainSum = baselineList.reduce((acc, d) => acc + d.precipitationSum, 0)
  const baselineRainAvg = Number((baselineRainSum / baselineDays).toFixed(1))
  const todayRain = Number(todayPoint.precipitationSum.toFixed(1))
  const rainDiff = Number((todayRain - baselineRainAvg).toFixed(1))

  let rainStatus: MetricComparison['status'] = 'same'
  let rainText = 'SIMILAR RAINFALL'
  if (rainDiff >= 10.0) {
    rainStatus = 'wetter'
    rainText = `+${rainDiff} mm MUCH WETTER`
  } else if (rainDiff >= 1.0) {
    rainStatus = 'wetter'
    rainText = `+${rainDiff} mm SLIGHTLY WETTER`
  } else if (rainDiff <= -10.0) {
    rainStatus = 'drier'
    rainText = `${rainDiff} mm MUCH DRIER`
  } else if (rainDiff <= -1.0) {
    rainStatus = 'drier'
    rainText = `${rainDiff} mm SLIGHTLY DRIER`
  }

  // C. Wind comparison (daily max wind average vs today's max wind)
  const baselineWindSum = baselineList.reduce((acc, d) => acc + d.windSpeedMax, 0)
  const baselineWindAvg = Number((baselineWindSum / baselineDays).toFixed(1))
  const todayWind = Number(todayPoint.windSpeedMax.toFixed(1))
  const windDiff = Number((todayWind - baselineWindAvg).toFixed(1))

  let windStatus: MetricComparison['status'] = 'same'
  let windText = 'SIMILAR WINDS'
  if (windDiff >= 10.0) {
    windStatus = 'stronger'
    windText = `+${Math.round(windDiff)} km/h MUCH STRONGER`
  } else if (windDiff >= 3.0) {
    windStatus = 'stronger'
    windText = `+${Math.round(windDiff)} km/h BREEZIER`
  } else if (windDiff <= -10.0) {
    windStatus = 'calmer'
    windText = `${Math.round(windDiff)} km/h MUCH CALMER`
  } else if (windDiff <= -3.0) {
    windStatus = 'calmer'
    windText = `${Math.round(windDiff)} km/h CALMER`
  }

  const comparison: TodayComparison = {
    temp: {
      diff: tempDiff,
      text: tempText,
      status: tempStatus,
      todayValue: Number(todayTempAvg.toFixed(1)),
      baselineAvg: Number(baselineTempAvg.toFixed(1)),
    },
    rain: {
      diff: rainDiff,
      text: rainText,
      status: rainStatus,
      todayValue: todayRain,
      baselineAvg: baselineRainAvg,
    },
    wind: {
      diff: windDiff,
      text: windText,
      status: windStatus,
      todayValue: todayWind,
      baselineAvg: baselineWindAvg,
    },
    baselineDays,
  }

  // 4. Smart Trend Summary (Deterministic Rules)
  let headline = `WEATHER CONDITIONS HAVE REMAINED FAIRLY STABLE OVER THE PAST ${baselineDays} DAYS.`
  let detail = `Mean temperatures (${baselineTempAvg.toFixed(1)}°C) and winds (${Math.round(baselineWindAvg)} km/h) are tracking close to recent patterns.`
  let tone: TrendSummary['tone'] = 'stable'

  if (tempStatus === 'warmer' && Math.abs(tempDiff) >= 3.0) {
    headline = `TODAY IS RUNNING SIGNIFICANTLY WARMER THAN THE RECENT ${baselineDays}-DAY AVERAGE.`
    detail = `Temperatures are elevated by +${tempDiff}°C above the ${baselineDays}-day baseline of ${baselineTempAvg.toFixed(1)}°C.`
    tone = 'warm'
  } else if (tempStatus === 'cooler' && Math.abs(tempDiff) >= 3.0) {
    headline = `TODAY IS RUNNING NOTICEABLY COOLER THAN THE RECENT ${baselineDays}-DAY AVERAGE.`
    detail = `Temperatures are dipping ${tempDiff}°C below the ${baselineDays}-day baseline of ${baselineTempAvg.toFixed(1)}°C.`
    tone = 'cool'
  } else if (rainStatus === 'wetter' && rainDiff >= 5.0) {
    headline = `RAINFALL IS RUNNING HIGHER THAN THE RECENT ${baselineDays}-DAY NORM.`
    detail = `Today recorded ${todayRain} mm of precipitation compared to the recent daily average of ${baselineRainAvg} mm.`
    tone = 'wet'
  } else if (windStatus === 'stronger' && windDiff >= 8.0) {
    headline = `WINDS ARE CURRENTLY STRONGER THAN OVER THE PAST ${baselineDays} DAYS.`
    detail = `Peak gusts are running +${Math.round(windDiff)} km/h above the recent baseline average of ${Math.round(baselineWindAvg)} km/h.`
    tone = 'windy'
  } else if (tempStatus === 'warmer') {
    headline = `TODAY IS RUNNING SLIGHTLY WARMER THAN THE RECENT ${baselineDays}-DAY NORM.`
    detail = `A mild uptick of +${tempDiff}°C over the recent average of ${baselineTempAvg.toFixed(1)}°C.`
    tone = 'warm'
  } else if (tempStatus === 'cooler') {
    headline = `TODAY IS RUNNING SLIGHTLY COOLER THAN THE RECENT ${baselineDays}-DAY NORM.`
    detail = `A moderate decrease of ${tempDiff}°C relative to the recent baseline of ${baselineTempAvg.toFixed(1)}°C.`
    tone = 'cool'
  }

  const summary: TrendSummary = {
    headline,
    detail,
    tone,
  }

  const resultData: WeatherTrendsData = {
    latitude,
    longitude,
    timezone,
    range,
    hourly24h,
    daily: dailyPoints,
    comparison,
    summary,
    fetchedAt: nowIso,
  }

  // Manage Cache
  if (trendsCache.size >= MAX_CACHE_ENTRIES) {
    cleanExpiredCache()
    if (trendsCache.size >= MAX_CACHE_ENTRIES) {
      // Evict oldest entry
      const firstKey = trendsCache.keys().next().value
      if (firstKey) trendsCache.delete(firstKey)
    }
  }

  trendsCache.set(cacheKey, {
    data: resultData,
    timestamp: Date.now(),
  })

  return resultData
}
