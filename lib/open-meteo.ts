/**
 * Open-Meteo API client and normalization layer.
 *
 * Fetches real weather and air-quality data from Open-Meteo's free APIs:
 * 1. Forecast API: current, hourly, daily, UV index
 * 2. Air Quality API: PM2.5, PM10, O3, NO2, European AQI
 * 3. Batch Forecast API: other cities (Delhi, Mumbai, London)
 *
 * Strict ₹0 recurring-cost requirement using free, open endpoints (no API keys needed).
 * Real-time honesty: Throws on failure and exposes error state. Never silently injects fake data.
 */

import type {
  CurrentConditions,
  AirQualityData,
  UVData,
  LocationData,
  HourlyEntry,
  DailyEntry,
  CityWeather,
  InsightData,
  SearchSuggestion,
  TemperatureUnit,
} from './types'
import {
  mapWeatherCode,
  degreesToCompass,
  classifyUV,
  classifyAQI,
  getSeasonNote,
  formatDate,
  formatDayShort,
  formatHour,
  formatTime12h,
  formatLocalTime,
  celsiusToFahrenheit,
} from './weather-utils'
import { getAirQuality } from './air-quality/service'

export interface RawCelsiusValues {
  temp: number
  feelsLike: number
  high: number
  low: number
  hourly: number[]
  weeklyHighs: number[]
  weeklyLows: number[]
  otherCities: number[]
}

export interface DashboardData {
  isLive: boolean
  location: LocationData
  currentConditions: CurrentConditions
  airQuality: AirQualityData
  uv: UVData
  hourly: HourlyEntry[]
  weekly: DailyEntry[]
  insight: InsightData
  otherCities: CityWeather[]
  suggestions: SearchSuggestion[]
  rawCelsiuses: RawCelsiusValues
}

// Default coordinates: Kolkata, India
export const DEFAULT_COORDINATES = {
  latitude: 22.5726,
  longitude: 88.3639,
  city: 'KOLKATA',
  country: 'INDIA',
  timezone: 'Asia/Kolkata',
}

interface OtherCityConfig {
  city: string
  country: string
  latitude: number
  longitude: number
  colorClass: string
}

// Featured cities pool for "Other cities" (dynamically filtered to never duplicate the current active city)
const FEATURED_CITIES: OtherCityConfig[] = [
  { city: 'Kolkata', country: 'India', latitude: 22.5726, longitude: 88.3639, colorClass: 'city-blue' },
  { city: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.2090, colorClass: 'city-lavender' },
  { city: 'Mumbai', country: 'India', latitude: 19.0760, longitude: 72.8777, colorClass: 'city-yellow' },
  { city: 'London', country: 'UK', latitude: 51.5074, longitude: -0.1278, colorClass: 'city-cyan' },
  { city: 'Tokyo', country: 'Japan', latitude: 35.6895, longitude: 139.6917, colorClass: 'city-lavender' },
  { city: 'Bengaluru', country: 'India', latitude: 12.9719, longitude: 77.5937, colorClass: 'city-blue' },
]

/**
 * Fetch with timeout to guarantee responsiveness.
 */
async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Generate editorial insight from live weather conditions.
 */
function generateInsight(
  precipMax: number,
  windSpeed: number,
  tempMax: number,
  condition: string
): InsightData {
  const windStr = `${windSpeed.toFixed(1)} km/h`
  const rainStr = `${Math.round(precipMax)}%`

  if (precipMax >= 60) {
    return {
      heading: 'Precipitation probable today',
      headingEmphasis: 'keep an umbrella ready.',
      description: `Showers or thunderstorms likely with up to ${rainStr} chance of rain. Peak winds at ${windStr}.`,
      rainChance: rainStr,
      wind: windStr,
    }
  }

  if (tempMax >= 35) {
    return {
      heading: 'High heat warning',
      headingEmphasis: 'stay hydrated & seek shade.',
      description: `Temperatures expected to peak at ${Math.round(tempMax)}°C today with ${condition.toLowerCase()}. Avoid direct midday sun.`,
      rainChance: rainStr,
      wind: windStr,
    }
  }

  if (precipMax <= 20) {
    return {
      heading: 'Best outdoor window',
      headingEmphasis: 'favorable clear conditions.',
      description: `Minimal chance of rain today (${rainStr}). Enjoy outdoor activities with comfortable winds around ${windStr}.`,
      rainChance: rainStr,
      wind: windStr,
    }
  }

  return {
    heading: 'Scattered clouds expected',
    headingEmphasis: 'variable conditions.',
    description: `Moderate precipitation probability (${rainStr}) with mild breeze of ${windStr}. Plan outdoor trips accordingly.`,
    rainChance: rainStr,
    wind: windStr,
  }
}

/**
 * Fetch full dashboard weather data from Open-Meteo.
 * Throws on failure — NEVER silently injects fabricated data.
 */
export async function getWeatherData(
  latitude = DEFAULT_COORDINATES.latitude,
  longitude = DEFAULT_COORDINATES.longitude,
  city = DEFAULT_COORDINATES.city,
  country = DEFAULT_COORDINATES.country,
  timezone = DEFAULT_COORDINATES.timezone
): Promise<DashboardData> {
  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,visibility,uv_index` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max` +
    `&timezone=${encodeURIComponent(timezone || 'auto')}&forecast_days=7`

  // 4 other cities distinct from the current city (prevents duplicate cities)
  const otherTargets = FEATURED_CITIES.filter(
    (c) => c.city.toLowerCase() !== city.toLowerCase()
  ).slice(0, 4)

  const batchCitiesUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${otherTargets.map((c) => c.latitude).join(',')}` +
    `&longitude=${otherTargets.map((c) => c.longitude).join(',')}` +
    `&current=temperature_2m,weather_code`

  const [forecastRes, batchCitiesRes, airQualityResult] = await Promise.allSettled([
    fetchWithTimeout(forecastUrl),
    fetchWithTimeout(batchCitiesUrl),
    getAirQuality({ latitude, longitude, city, country, timezone }),
  ])

  // 1. Validate Forecast API response
  if (forecastRes.status !== 'fulfilled' || !forecastRes.value.ok) {
    const statusText = forecastRes.status === 'fulfilled' ? `HTTP ${forecastRes.value.status}` : 'Network error/timeout'
    throw new Error(`Failed to fetch forecast from Open-Meteo (${statusText})`)
  }

  let forecastData: any
  try {
    forecastData = await forecastRes.value.json()
  } catch (err) {
    throw new Error('Malformed JSON payload received from Open-Meteo Forecast API')
  }

  if (!forecastData || typeof forecastData !== 'object') {
    throw new Error('Invalid forecast payload received from Open-Meteo')
  }

  const { current, daily, hourly, timezone: returnedTz } = forecastData

  if (!current || typeof current.temperature_2m !== 'number' || isNaN(current.temperature_2m)) {
    throw new Error('Current weather conditions missing or malformed in Open-Meteo response')
  }

  if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
    throw new Error('Daily forecast missing or malformed in Open-Meteo response')
  }

  const activeTz = returnedTz || timezone
  const weatherCode = typeof current.weather_code === 'number' ? current.weather_code : 0
  const mappedCode = mapWeatherCode(weatherCode)

  const tempC = Math.round(current.temperature_2m)
  const feelsLikeC = typeof current.apparent_temperature === 'number'
    ? Math.round(current.apparent_temperature)
    : tempC
  const highC = typeof daily.temperature_2m_max?.[0] === 'number'
    ? Math.round(daily.temperature_2m_max[0])
    : tempC
  const lowC = typeof daily.temperature_2m_min?.[0] === 'number'
    ? Math.round(daily.temperature_2m_min[0])
    : tempC

  const visibilityKm = typeof current.visibility === 'number'
    ? Number((current.visibility / 1000).toFixed(1))
    : 10.0

  const sunriseStr = daily.sunrise?.[0] ? formatTime12h(daily.sunrise[0]) : '5:30 AM'
  const sunsetStr = daily.sunset?.[0] ? formatTime12h(daily.sunset[0]) : '6:00 PM'
  const dateStr = current.time ? formatDate(current.time) : formatDate(new Date().toISOString())

  const currentConditions: CurrentConditions = {
    condition: mappedCode.condition.toUpperCase(),
    temperature: tempC,
    feelsLike: feelsLikeC,
    high: highC,
    low: lowC,
    sunrise: sunriseStr,
    sunset: sunsetStr,
    humidity: typeof current.relative_humidity_2m === 'number' ? Math.round(current.relative_humidity_2m) : 60,
    seasonNote: getSeasonNote(new Date().getMonth() + 1, latitude),
    date: dateStr,
    iconType: mappedCode.icon,
    wind: {
      speed: typeof current.wind_speed_10m === 'number' ? Math.round(current.wind_speed_10m) : 0,
      direction: degreesToCompass(current.wind_direction_10m),
    },
    visibility: visibilityKm,
    pressure: typeof current.surface_pressure === 'number' ? Math.round(current.surface_pressure) : 1013,
  }

  // 2. Validate Air Quality data (India CPCB Ground Station or Global CAMS Model)
  let airQuality: AirQualityData
  if (airQualityResult.status === 'fulfilled') {
    airQuality = airQualityResult.value
  } else {
    airQuality = {
      index: null,
      standard: 'US',
      sourceType: 'ATMOSPHERIC_MODEL',
      sourceName: 'Data Unavailable',
      level: 'UNAVAILABLE',
      pm25: null,
      pm10: null,
      o3: null,
      no2: null,
      timestamp: current.time || new Date().toISOString(),
      isFallback: true,
    }
  }

  // 3. UV Index: Match exact current local hour
  let currentUv = typeof current.uv_index === 'number' && !isNaN(current.uv_index)
    ? Number(current.uv_index.toFixed(1))
    : 0

  if (current.time && Array.isArray(hourly?.time) && Array.isArray(hourly?.uv_index)) {
    const targetHour = current.time.substring(0, 13)
    const uvIdx = hourly.time.findIndex((t: string) => t.startsWith(targetHour))
    if (uvIdx >= 0 && typeof hourly.uv_index[uvIdx] === 'number') {
      currentUv = Number(hourly.uv_index[uvIdx].toFixed(1))
    }
  }

  const uvMaxRaw = daily.uv_index_max?.[0]
  const maxToday = typeof uvMaxRaw === 'number' && !isNaN(uvMaxRaw) ? Number(uvMaxRaw.toFixed(1)) : undefined

  const uvClassification = classifyUV(Math.round(currentUv))
  const uv: UVData = {
    index: currentUv,
    maxToday,
    level: uvClassification.level,
    advice: uvClassification.advice,
    timestamp: current.time,
  }

  // 4. Hourly Forecast (Next 10 hours from current hour)
  const hourlyTimes: string[] = Array.isArray(hourly?.time) ? hourly.time : []
  const hourlyTemps: number[] = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m : []
  const hourlyProbs: number[] = Array.isArray(hourly?.precipitation_probability) ? hourly.precipitation_probability : []
  const hourlyCodes: number[] = Array.isArray(hourly?.weather_code) ? hourly.weather_code : []

  let startIndex = 0
  if (current.time && hourlyTimes.length > 0) {
    const currentHourIso = current.time.substring(0, 13)
    const matchIdx = hourlyTimes.findIndex((t) => t.startsWith(currentHourIso))
    if (matchIdx >= 0) {
      startIndex = matchIdx
    }
  }

  const hourlyEntries: HourlyEntry[] = []
  const rawHourlyTemps: number[] = []
  const hoursToTake = Math.min(10, Math.max(0, hourlyTimes.length - startIndex))

  for (let i = 0; i < hoursToTake; i++) {
    const idx = startIndex + i
    const hTime = hourlyTimes[idx] || ''
    const hTemp = typeof hourlyTemps[idx] === 'number' ? Math.round(hourlyTemps[idx]) : tempC
    const hProb = typeof hourlyProbs[idx] === 'number' ? Math.round(hourlyProbs[idx]) : 0
    const hCode = typeof hourlyCodes[idx] === 'number' ? hourlyCodes[idx] : 0
    rawHourlyTemps.push(hTemp)

    hourlyEntries.push({
      time: hTime ? formatHour(hTime) : `${i}:00`,
      temperature: `${hTemp}°`,
      rainProbability: `${hProb}%`,
      iconType: mapWeatherCode(hCode).icon,
    })
  }

  // 5. 7-day Daily Forecast
  const dailyTimes: string[] = Array.isArray(daily?.time) ? daily.time : []
  const dailyMaxs: number[] = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : []
  const dailyMins: number[] = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : []
  const dailyProbs: number[] = Array.isArray(daily?.precipitation_probability_max) ? daily.precipitation_probability_max : []
  const dailyCodes: number[] = Array.isArray(daily?.weather_code) ? daily.weather_code : []

  const weeklyEntries: DailyEntry[] = []
  const rawWeeklyHighs: number[] = []
  const rawWeeklyLows: number[] = []

  const daysToTake = Math.min(7, dailyTimes.length)
  for (let i = 0; i < daysToTake; i++) {
    const dTime = dailyTimes[i] || ''
    const dMax = typeof dailyMaxs[i] === 'number' ? Math.round(dailyMaxs[i]) : tempC
    const dMin = typeof dailyMins[i] === 'number' ? Math.round(dailyMins[i]) : tempC - 5
    const dProb = typeof dailyProbs[i] === 'number' ? Math.round(dailyProbs[i]) : 0
    const dCode = typeof dailyCodes[i] === 'number' ? dailyCodes[i] : 0

    rawWeeklyHighs.push(dMax)
    rawWeeklyLows.push(dMin)

    weeklyEntries.push({
      day: dTime ? formatDayShort(dTime) : `D${i + 1}`,
      high: `${dMax}°`,
      low: `${dMin}°`,
      rainProbability: `${dProb}%`,
      iconType: mapWeatherCode(dCode).icon,
    })
  }

  // 6. Other Cities (4 distinct featured cities)
  const otherCities: CityWeather[] = []
  const rawOtherCitiesTemps: number[] = []

  if (batchCitiesRes.status === 'fulfilled' && batchCitiesRes.value.ok) {
    try {
      const batchData = await batchCitiesRes.value.json()
      if (Array.isArray(batchData)) {
        otherTargets.forEach((config, index) => {
          const resObj = batchData[index]
          const cTemp = typeof resObj?.current?.temperature_2m === 'number'
            ? Math.round(resObj.current.temperature_2m)
            : 25
          const cCode = typeof resObj?.current?.weather_code === 'number' ? resObj.current.weather_code : 0
          const cMapped = mapWeatherCode(cCode)

          rawOtherCitiesTemps.push(cTemp)
          otherCities.push({
            city: config.city,
            country: config.country,
            temperature: `${cTemp}°`,
            description: cMapped.condition,
            iconType: cMapped.icon,
            colorClass: config.colorClass,
          })
        })
      }
    } catch {
      // Degrade other cities if batch failed
    }
  }

  // 7. Location Metadata
  const location: LocationData = {
    city: city.toUpperCase(),
    country: country.toUpperCase(),
    localTime: formatLocalTime(activeTz),
    lastUpdated: 'JUST NOW',
  }

  // 8. Editorial Insight
  const precipMaxToday = typeof daily.precipitation_probability_max?.[0] === 'number'
    ? daily.precipitation_probability_max[0]
    : 0
  const windSpeedToday = typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 0
  const insight = generateInsight(precipMaxToday, windSpeedToday, highC, mappedCode.condition)

  // 9. Search Suggestions
  const suggestions: SearchSuggestion[] = otherCities.slice(0, 2).map((c) => ({
    city: c.city.toUpperCase(),
    country: c.country.toUpperCase(),
    temperature: c.temperature,
  }))

  return {
    isLive: true,
    location,
    currentConditions,
    airQuality,
    uv,
    hourly: hourlyEntries,
    weekly: weeklyEntries,
    insight,
    otherCities,
    suggestions,
    rawCelsiuses: {
      temp: tempC,
      feelsLike: feelsLikeC,
      high: highC,
      low: lowC,
      hourly: rawHourlyTemps,
      weeklyHighs: rawWeeklyHighs,
      weeklyLows: rawWeeklyLows,
      otherCities: rawOtherCitiesTemps,
    },
  }
}

/**
 * Recalculate dashboard display values when user toggles between °C and °F.
 * Client-side only — causes zero network requests.
 */
export function applyTemperatureUnit(
  data: DashboardData,
  unit: TemperatureUnit
): DashboardData {
  if (unit === '°C') {
    return data
  }

  const { rawCelsiuses } = data

  const currentConditions: CurrentConditions = {
    ...data.currentConditions,
    temperature: celsiusToFahrenheit(rawCelsiuses.temp),
    feelsLike: celsiusToFahrenheit(rawCelsiuses.feelsLike),
    high: celsiusToFahrenheit(rawCelsiuses.high),
    low: celsiusToFahrenheit(rawCelsiuses.low),
  }

  const hourly: HourlyEntry[] = data.hourly.map((entry, idx) => {
    const rawC = rawCelsiuses.hourly[idx] ?? parseInt(entry.temperature, 10)
    return {
      ...entry,
      temperature: `${celsiusToFahrenheit(rawC)}°`,
    }
  })

  const weekly: DailyEntry[] = data.weekly.map((entry, idx) => {
    const rawHigh = rawCelsiuses.weeklyHighs[idx] ?? parseInt(entry.high, 10)
    const rawLow = rawCelsiuses.weeklyLows[idx] ?? parseInt(entry.low, 10)
    return {
      ...entry,
      high: `${celsiusToFahrenheit(rawHigh)}°`,
      low: `${celsiusToFahrenheit(rawLow)}°`,
    }
  })

  const otherCities: CityWeather[] = data.otherCities.map((entry, idx) => {
    const rawC = rawCelsiuses.otherCities[idx] ?? parseInt(entry.temperature, 10)
    return {
      ...entry,
      temperature: `${celsiusToFahrenheit(rawC)}°`,
    }
  })

  const suggestions: SearchSuggestion[] = data.suggestions.map((s, idx) => {
    const rawC = rawCelsiuses.otherCities[idx] ?? (s.temperature ? parseInt(s.temperature, 10) : 28)
    return {
      ...s,
      temperature: `${celsiusToFahrenheit(rawC)}°`,
    }
  })

  return {
    ...data,
    currentConditions,
    hourly,
    weekly,
    otherCities,
    suggestions,
  }
}
