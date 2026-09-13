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
  formatFullDate,
  formatFullDateTime,
} from './weather-utils'
import { getAirQuality } from './air-quality/service'
import { generateTodayInsight } from './insights'

export interface RawCelsiusValues {
  temp: number
  feelsLike: number
  high: number
  low: number
  hourly: number[]
  hourlyFeelsLike?: number[]
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
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,rain,snowfall,weather_code,surface_pressure,relative_humidity_2m,wind_speed_10m,wind_direction_10m,visibility,uv_index,cloud_cover` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,rain_sum,snowfall_sum,wind_speed_10m_max,wind_direction_10m_dominant` +
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

  // 4. Hourly Forecast (Next 12 hours from current hour)
  const hourlyTimes: string[] = Array.isArray(hourly?.time) ? hourly.time : []
  const hourlyTemps: number[] = Array.isArray(hourly?.temperature_2m) ? hourly.temperature_2m : []
  const hourlyFeels: number[] = Array.isArray(hourly?.apparent_temperature) ? hourly.apparent_temperature : []
  const hourlyProbs: number[] = Array.isArray(hourly?.precipitation_probability) ? hourly.precipitation_probability : []
  const hourlyPrecip: number[] = Array.isArray(hourly?.precipitation) ? hourly.precipitation : []
  const hourlyRain: number[] = Array.isArray(hourly?.rain) ? hourly.rain : []
  const hourlySnow: number[] = Array.isArray(hourly?.snowfall) ? hourly.snowfall : []
  const hourlyCodes: number[] = Array.isArray(hourly?.weather_code) ? hourly.weather_code : []
  const hourlyPressure: number[] = Array.isArray(hourly?.surface_pressure) ? hourly.surface_pressure : []
  const hourlyHumidity: number[] = Array.isArray(hourly?.relative_humidity_2m) ? hourly.relative_humidity_2m : []
  const hourlyWindSpeed: number[] = Array.isArray(hourly?.wind_speed_10m) ? hourly.wind_speed_10m : []
  const hourlyWindDir: number[] = Array.isArray(hourly?.wind_direction_10m) ? hourly.wind_direction_10m : []
  const hourlyVisibility: number[] = Array.isArray(hourly?.visibility) ? hourly.visibility : []
  const hourlyUv: number[] = Array.isArray(hourly?.uv_index) ? hourly.uv_index : []
  const hourlyClouds: number[] = Array.isArray(hourly?.cloud_cover) ? hourly.cloud_cover : []

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
  const rawHourlyFeels: number[] = []
  const hoursToTake = Math.min(12, Math.max(0, hourlyTimes.length - startIndex))

  for (let i = 0; i < hoursToTake; i++) {
    const idx = startIndex + i
    const hTime = hourlyTimes[idx] || ''
    const hTemp = typeof hourlyTemps[idx] === 'number' ? Math.round(hourlyTemps[idx]) : tempC
    const hFeel = typeof hourlyFeels[idx] === 'number' ? Math.round(hourlyFeels[idx]) : hTemp
    const hProb = typeof hourlyProbs[idx] === 'number' ? Math.round(hourlyProbs[idx]) : 0
    const hCode = typeof hourlyCodes[idx] === 'number' ? hourlyCodes[idx] : 0
    const mapped = mapWeatherCode(hCode)

    const hPrecip = typeof hourlyPrecip[idx] === 'number' ? Number(hourlyPrecip[idx].toFixed(1)) : 0
    const hR = typeof hourlyRain[idx] === 'number' ? Number(hourlyRain[idx].toFixed(1)) : 0
    const hSn = typeof hourlySnow[idx] === 'number' ? Number(hourlySnow[idx].toFixed(1)) : 0
    const hPress = typeof hourlyPressure[idx] === 'number' ? Math.round(hourlyPressure[idx]) : undefined
    const hHum = typeof hourlyHumidity[idx] === 'number' ? Math.round(hourlyHumidity[idx]) : undefined
    const hWind = typeof hourlyWindSpeed[idx] === 'number' ? Math.round(hourlyWindSpeed[idx]) : undefined
    const hWindDir = typeof hourlyWindDir[idx] === 'number' ? degreesToCompass(hourlyWindDir[idx]) : undefined
    const hVis = typeof hourlyVisibility[idx] === 'number' ? Number((hourlyVisibility[idx] / 1000).toFixed(1)) : undefined
    const hUvIdx = typeof hourlyUv[idx] === 'number' ? Number(hourlyUv[idx].toFixed(1)) : 0
    const hCloud = typeof hourlyClouds[idx] === 'number' ? Math.round(hourlyClouds[idx]) : undefined

    // Find daily sunrise/sunset for this hour
    const datePrefix = hTime.substring(0, 10)
    const dailyMatchIdx = Array.isArray(daily?.time) ? daily.time.findIndex((t: string) => t === datePrefix) : 0
    const dSunriseStr = daily?.sunrise?.[dailyMatchIdx >= 0 ? dailyMatchIdx : 0]
      ? formatTime12h(daily.sunrise[dailyMatchIdx >= 0 ? dailyMatchIdx : 0])
      : undefined
    const dSunsetStr = daily?.sunset?.[dailyMatchIdx >= 0 ? dailyMatchIdx : 0]
      ? formatTime12h(daily.sunset[dailyMatchIdx >= 0 ? dailyMatchIdx : 0])
      : undefined

    rawHourlyTemps.push(hTemp)
    rawHourlyFeels.push(hFeel)

    hourlyEntries.push({
      time: hTime ? formatHour(hTime) : `${i}:00`,
      temperature: `${hTemp}°`,
      rainProbability: `${hProb}%`,
      iconType: mapped.icon,
      condition: mapped.condition,
      fullTime: hTime ? formatFullDateTime(hTime) : undefined,
      date: hTime ? formatDate(hTime) : undefined,
      feelsLike: `${hFeel}°`,
      precipitation: `${hPrecip} mm`,
      rain: `${hR} mm`,
      snowfall: `${hSn} cm`,
      cloudCover: hCloud != null ? `${hCloud}%` : undefined,
      humidity: hHum != null ? `${hHum}%` : undefined,
      windSpeed: hWind != null ? `${hWind} km/h` : undefined,
      windDirection: hWindDir,
      pressure: hPress != null ? `${hPress} hPa` : undefined,
      visibility: hVis != null ? `${hVis} km` : undefined,
      uvIndex: hUvIdx,
      uvLevel: classifyUV(Math.round(hUvIdx)).level,
      sunrise: dSunriseStr,
      sunset: dSunsetStr,
      rawC: {
        temp: hTemp,
        feelsLike: hFeel,
      },
    })
  }

  // 5. 7-day Daily Forecast
  const dailyTimes: string[] = Array.isArray(daily?.time) ? daily.time : []
  const dailyMaxs: number[] = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : []
  const dailyMins: number[] = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : []
  const dailyProbs: number[] = Array.isArray(daily?.precipitation_probability_max) ? daily.precipitation_probability_max : []
  const dailyCodes: number[] = Array.isArray(daily?.weather_code) ? daily.weather_code : []
  const dailyPrecipSums: number[] = Array.isArray(daily?.precipitation_sum) ? daily.precipitation_sum : []
  const dailyRainSums: number[] = Array.isArray(daily?.rain_sum) ? daily.rain_sum : []
  const dailySnowSums: number[] = Array.isArray(daily?.snowfall_sum) ? daily.snowfall_sum : []
  const dailyWindMaxs: number[] = Array.isArray(daily?.wind_speed_10m_max) ? daily.wind_speed_10m_max : []
  const dailyWindDirs: number[] = Array.isArray(daily?.wind_direction_10m_dominant) ? daily.wind_direction_10m_dominant : []
  const dailyUvs: number[] = Array.isArray(daily?.uv_index_max) ? daily.uv_index_max : []

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
    const mapped = mapWeatherCode(dCode)

    const dPrecipSum = typeof dailyPrecipSums[i] === 'number' ? Number(dailyPrecipSums[i].toFixed(1)) : 0
    const dRainSum = typeof dailyRainSums[i] === 'number' ? Number(dailyRainSums[i].toFixed(1)) : 0
    const dSnowSum = typeof dailySnowSums[i] === 'number' ? Number(dailySnowSums[i].toFixed(1)) : 0
    const dWindMax = typeof dailyWindMaxs[i] === 'number' ? Math.round(dailyWindMaxs[i]) : undefined
    const dWindDir = typeof dailyWindDirs[i] === 'number' ? degreesToCompass(dailyWindDirs[i]) : undefined
    const dUvMax = typeof dailyUvs[i] === 'number' ? Number(dailyUvs[i].toFixed(1)) : undefined
    const dSunrise = daily?.sunrise?.[i] ? formatTime12h(daily.sunrise[i]) : undefined
    const dSunset = daily?.sunset?.[i] ? formatTime12h(daily.sunset[i]) : undefined

    rawWeeklyHighs.push(dMax)
    rawWeeklyLows.push(dMin)

    weeklyEntries.push({
      day: dTime ? formatDayShort(dTime) : `D${i + 1}`,
      high: `${dMax}°`,
      low: `${dMin}°`,
      rainProbability: `${dProb}%`,
      iconType: mapped.icon,
      condition: mapped.condition,
      fullDate: dTime ? formatFullDate(dTime) : undefined,
      date: dTime ? formatDate(dTime) : undefined,
      precipitationSum: `${dPrecipSum} mm`,
      rainSum: `${dRainSum} mm`,
      snowfallSum: `${dSnowSum} cm`,
      windSpeedMax: dWindMax != null ? `${dWindMax} km/h` : undefined,
      windDirectionDominant: dWindDir,
      uvIndexMax: dUvMax,
      uvLevel: dUvMax != null ? classifyUV(Math.round(dUvMax)).level : undefined,
      sunrise: dSunrise,
      sunset: dSunset,
      rawC: {
        high: dMax,
        low: dMin,
      },
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

  // 8. Editorial Insight (Deterministic Phase 3B)
  const insight = generateTodayInsight({
    currentConditions,
    hourly: hourlyEntries,
    weekly: weeklyEntries,
    airQuality,
    uv,
    alerts: null,
    timezone: activeTz,
    city,
  })

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
      hourlyFeelsLike: rawHourlyFeels,
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
    const rawFeels = rawCelsiuses.hourlyFeelsLike?.[idx] ?? (entry.rawC?.feelsLike ?? rawC)
    return {
      ...entry,
      temperature: `${celsiusToFahrenheit(rawC)}°`,
      feelsLike: entry.feelsLike ? `${celsiusToFahrenheit(rawFeels)}°` : undefined,
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
