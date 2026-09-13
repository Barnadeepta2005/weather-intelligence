import type { AirWeatherGuidanceData, AirWeatherLevel } from './types'
import type { CurrentConditions, AirQualityData } from '@/lib/types'

interface AirWeatherInput {
  current: CurrentConditions
  airQuality?: AirQualityData
}

export function computeAirWeatherGuidance({
  current,
  airQuality,
}: AirWeatherInput): AirWeatherGuidanceData {
  const aqiVal = airQuality?.index ?? 50
  const windKm = current.wind?.speed ?? 0
  const humidityVal = current.humidity ?? 50

  const isCpcb =
    airQuality?.standard === 'CPCB' ||
    airQuality?.sourceType === 'GROUND_STATION' ||
    airQuality?.sourceName?.toUpperCase().includes('CPCB')

  const sourceType: AirWeatherGuidanceData['sourceType'] = isCpcb
    ? 'CPCB Ground Station'
    : 'Atmospheric Model'

  let level: AirWeatherLevel = 'GOOD'
  let headline = 'Air quality is favorable.'
  let details = 'Clean air conditions allow unconstrained outdoor plans.'
  let windInteraction = 'Winds are providing healthy air exchange.'

  if (windKm < 8) {
    windInteraction = `Light winds (${Math.round(windKm)} km/h) may allow particulate matter to settle near the surface.`
  } else if (windKm >= 20) {
    windInteraction = `Brisk winds (${Math.round(windKm)} km/h) provide active atmospheric dispersion.`
  }

  if (aqiVal >= 301) {
    level = 'HAZARDOUS'
    headline = 'Severe air pollution levels.'
    details = `AQI of ${aqiVal} measured via ${sourceType}. High humidity (${humidityVal}%) may intensify particulate retention.`
  } else if (aqiVal >= 201) {
    level = 'UNHEALTHY'
    headline = 'Poor air quality detected.'
    details = `AQI of ${aqiVal} (${sourceType}). Sensitive individuals and active outdoor workers should limit heavy breathing.`
  } else if (aqiVal >= 101) {
    level = 'MODERATE'
    headline = 'Air quality is moderate.'
    details = `AQI of ${aqiVal} reported by ${sourceType}. ${windInteraction}`
  } else if (aqiVal >= 51) {
    level = 'MODERATE'
    headline = 'Acceptable air quality.'
    details = `AQI of ${aqiVal} (${sourceType}). ${windInteraction}`
  }

  return {
    level,
    headline,
    details,
    aqi: aqiVal,
    sourceType,
    dominantPollutant: airQuality?.prominentPollutant,
    windInteraction,
  }
}
