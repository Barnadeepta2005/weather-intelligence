import type { WeatherIntelligenceData } from './types'
import { calculateWeatherRisk } from './risk'
import { computeRainTiming } from './rain-timing'
import { computeOutdoorGuidance } from './activity'
import { computeCommuteGuidance } from './commute'
import { computeHeatUvGuidance } from './heat-uv'
import { computeAirWeatherGuidance } from './air-weather'
import { computeActionPlan } from './action-plan'
import type { CurrentConditions, AirQualityData, UVData, HourlyEntry, TemperatureUnit } from '@/lib/types'
import type { WeatherAlert } from '@/lib/alerts/types'

export * from './types'
export { calculateWeatherRisk } from './risk'
export { computeRainTiming } from './rain-timing'
export { computeOutdoorGuidance } from './activity'
export { computeCommuteGuidance } from './commute'
export { computeHeatUvGuidance } from './heat-uv'
export { computeAirWeatherGuidance } from './air-weather'
export { computeActionPlan } from './action-plan'

export interface ComputeWeatherIntelligenceParams {
  current: CurrentConditions
  rawFeelsLikeC?: number
  hourly?: HourlyEntry[]
  airQuality?: AirQualityData
  uv?: UVData
  alerts?: WeatherAlert[]
  unit?: TemperatureUnit
}

export function computeWeatherIntelligence({
  current,
  rawFeelsLikeC,
  hourly = [],
  airQuality,
  uv,
  alerts = [],
}: ComputeWeatherIntelligenceParams): WeatherIntelligenceData {
  // Canonical Celsius value for reliable internal threshold calculation
  const feelsLikeC = rawFeelsLikeC ?? current.feelsLike ?? 25

  // Determine peak rain probability from hourly forecast
  const peakRainProb = hourly.reduce((max, h) => {
    const p = parseInt(h.rainProbability?.replace('%', '') || '0', 10) || 0
    return Math.max(max, p)
  }, 0)

  // 1. Overall Weather Risk Score
  const risk = calculateWeatherRisk({
    current,
    feelsLikeC,
    airQuality,
    uv,
    alerts,
    rainProbability: peakRainProb,
  })

  // 2. Rain Arrival Timing
  const rainTiming = computeRainTiming({
    hourly,
    currentCondition: current.condition,
  })

  // 3. Outdoor Activity Guidance
  const outdoor = computeOutdoorGuidance({
    current,
    feelsLikeC,
    airQuality,
    uv,
    alerts,
    peakRainProbability: peakRainProb,
  })

  // 4. Commute Intelligence
  const commute = computeCommuteGuidance({
    current,
    hourly,
    alerts,
  })

  // 5. Heat + UV Guidance
  const heatUv = computeHeatUvGuidance({
    current,
    feelsLikeC,
    uv,
  })

  // 6. Air + Weather Combined Risk
  const airWeather = computeAirWeatherGuidance({
    current,
    airQuality,
  })

  // 7. Today's Action Plan (Max 3 prioritized items)
  const actionPlan = computeActionPlan({
    current,
    feelsLikeC,
    hourly,
    airQuality,
    uv,
    alerts,
    peakRainProbability: peakRainProb,
  })

  return {
    risk,
    outdoor,
    commute,
    rainTiming,
    heatUv,
    airWeather,
    actionPlan,
    computedAt: new Date().toISOString(),
  }
}
