import type { HeatUvGuidanceData, HeatUvLevel } from './types'
import type { CurrentConditions, UVData } from '@/lib/types'

interface HeatUvInput {
  current: CurrentConditions
  feelsLikeC: number
  uv?: UVData
  isDaytime?: boolean
}

export function computeHeatUvGuidance({
  current,
  feelsLikeC,
  uv,
  isDaytime = true,
}: HeatUvInput): HeatUvGuidanceData {
  const uvVal = uv?.maxToday ?? uv?.index ?? 0
  const humidityVal = current.humidity ?? 50

  // Thermal/Solar Stress Index (0-10 scale approximation)
  let heatScore = 1
  if (feelsLikeC >= 41) heatScore = 5
  else if (feelsLikeC >= 37) heatScore = 4
  else if (feelsLikeC >= 32) heatScore = 3
  else if (feelsLikeC >= 27) heatScore = 2

  let uvScore = 1
  if (uvVal >= 11) uvScore = 5
  else if (uvVal >= 8) uvScore = 4
  else if (uvVal >= 6) uvScore = 3
  else if (uvVal >= 3) uvScore = 2

  const combinedMax = Math.max(heatScore, uvScore)

  let level: HeatUvLevel = 'LOW'
  let headline = 'Heat and UV levels are minimal.'
  let details = 'Atmospheric solar radiation and thermal heat are well within comfortable ranges.'

  if (combinedMax === 5) {
    level = 'VERY HIGH'
    headline = 'Extreme heat or UV radiation active.'
    details =
      uvVal >= 11
        ? `Extreme UV Index (${uvVal}) with elevated apparent temperature (${Math.round(feelsLikeC)}°C). Seek shade between 11 AM – 3 PM.`
        : `Severe thermal heat index (feels ${Math.round(feelsLikeC)}°C, ${humidityVal}% humidity). Take frequent hydration breaks.`
  } else if (combinedMax === 4) {
    level = 'HIGH'
    headline = 'High UV and/or heat conditions.'
    details =
      uvVal >= 8
        ? `Very high UV Index (${uvVal}). Apply sun protection and avoid prolonged unshaded exposure.`
        : `Apparent temperature feels like ${Math.round(feelsLikeC)}°C with ${humidityVal}% humidity. Schedule physical activity for morning or evening.`
  } else if (combinedMax === 3) {
    level = 'MODERATE'
    headline = 'Warm conditions with moderate UV.'
    details = `UV Index peaks near ${uvVal}; feels-like temperature is ${Math.round(feelsLikeC)}°C. Normal hydration and sun precautions apply.`
  }

  return {
    level,
    headline,
    details,
    uvIndex: uvVal,
    feelsLikeC,
    isDaytime,
  }
}
