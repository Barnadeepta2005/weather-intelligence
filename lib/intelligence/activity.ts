import type { OutdoorGuidanceData, OutdoorState } from './types'
import type { WeatherAlert } from '@/lib/alerts/types'
import type { CurrentConditions, AirQualityData, UVData } from '@/lib/types'

interface ActivityCalculatorInput {
  current: CurrentConditions
  feelsLikeC: number
  airQuality?: AirQualityData
  uv?: UVData
  alerts?: WeatherAlert[]
  peakRainProbability?: number
}

export function computeOutdoorGuidance({
  current,
  feelsLikeC,
  airQuality,
  uv,
  alerts = [],
  peakRainProbability = 0,
}: ActivityCalculatorInput): OutdoorGuidanceData {
  const windKm = current.wind?.speed ?? 0
  const aqiVal = airQuality?.index ?? 0
  const uvVal = uv?.maxToday ?? uv?.index ?? 0
  const condLower = (current.condition || '').toLowerCase()

  const hasRedAlert = alerts.some((a) => a.severity.toLowerCase() === 'red')
  const hasOrangeAlert = alerts.some((a) => a.severity.toLowerCase() === 'orange')
  const isStormy =
    condLower.includes('thunder') ||
    condLower.includes('storm') ||
    condLower.includes('heavy rain')

  // 1. AVOID State
  if (hasRedAlert || (hasOrangeAlert && isStormy) || windKm >= 65 || aqiVal >= 380) {
    let keyFactor = 'OFFICIAL SEVERE WARNING'
    if (aqiVal >= 380) keyFactor = 'HAZARDOUS AIR POLLUTION'
    else if (windKm >= 65) keyFactor = 'GALE-FORCE WINDS'

    return {
      state: 'AVOID',
      headline: 'Outdoor activities should be postponed.',
      details: hasRedAlert
        ? 'An official severe weather warning is active. Minimize non-essential outdoor exposure.'
        : aqiVal >= 380
        ? 'Hazardous air quality detected. Outdoor workouts and extended exposure are strongly discouraged.'
        : 'High winds and stormy conditions make outdoor activities hazardous.',
      keyFactor,
    }
  }

  // 2. NOT IDEAL State
  if (
    hasOrangeAlert ||
    isStormy ||
    peakRainProbability >= 65 ||
    windKm >= 40 ||
    feelsLikeC >= 42 ||
    feelsLikeC <= 2 ||
    aqiVal >= 250
  ) {
    let keyFactor = 'RAIN & GUSTS'
    let details = 'Active or anticipated precipitation and brisk winds may disrupt outdoor plans.'

    if (aqiVal >= 250) {
      keyFactor = 'POOR AIR QUALITY'
      details = `Elevated particulate levels (AQI ${aqiVal}). Reduce heavy exertion outdoors.`
    } else if (feelsLikeC >= 42) {
      keyFactor = 'EXCESSIVE HEAT'
      details = `Thermal heat index is severe (feels ${Math.round(feelsLikeC)}°C). Prolonged outdoor exertion is unfavorable.`
    } else if (hasOrangeAlert) {
      keyFactor = 'OFFICIAL ALERT'
      details = 'An official meteorological advisory is active for your area. Keep plans flexible.'
    }

    return {
      state: 'NOT IDEAL',
      headline: 'Outdoor conditions are currently unfavorable.',
      details,
      keyFactor,
    }
  }

  // 3. CAUTION State
  if (
    uvVal >= 8 ||
    feelsLikeC >= 36 ||
    feelsLikeC <= 8 ||
    peakRainProbability >= 35 ||
    windKm >= 28 ||
    aqiVal >= 120
  ) {
    let keyFactor = 'MODERATE CONDITIONS'
    let details = 'Conditions are acceptable with reasonable precautions.'

    if (uvVal >= 8) {
      keyFactor = 'HIGH UV INDEX'
      details = `UV index peaks at ${uvVal}. Seek shade during midday and apply sun protection.`
    } else if (feelsLikeC >= 36) {
      keyFactor = 'ELEVATED HEAT'
      details = `Heat index feels like ${Math.round(feelsLikeC)}°C. Stay hydrated and schedule intensive workouts early.`
    } else if (peakRainProbability >= 35) {
      keyFactor = 'SCATTERED SHOWERS'
      details = `Scattered showers are possible (${peakRainProbability}% peak chance). Carry rain protection.`
    } else if (aqiVal >= 120) {
      keyFactor = 'MODERATE AIR QUALITY'
      details = `Air quality is moderately elevated (AQI ${aqiVal}). Sensitive groups should take periodic breaks.`
    }

    return {
      state: 'CAUTION',
      headline: 'Suitable with minor precautions.',
      details,
      keyFactor,
    }
  }

  // 4. GOOD State
  return {
    state: 'GOOD',
    headline: 'Conditions look favorable for outdoor plans.',
    details: 'Temperatures, air quality, and wind are comfortable with low precipitation risk.',
    keyFactor: 'CALM ATMOSPHERE',
  }
}
