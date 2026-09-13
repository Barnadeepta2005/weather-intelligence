import type { WeatherRiskData, RiskLevel } from './types'
import type { WeatherAlert } from '@/lib/alerts/types'
import type { CurrentConditions, AirQualityData, UVData } from '@/lib/types'

interface RiskCalculatorInput {
  current: CurrentConditions
  feelsLikeC: number
  airQuality?: AirQualityData
  uv?: UVData
  alerts?: WeatherAlert[]
  rainProbability?: number
}

export function calculateWeatherRisk({
  current,
  feelsLikeC,
  airQuality,
  uv,
  alerts = [],
  rainProbability = 0,
}: RiskCalculatorInput): WeatherRiskData {
  let score = 0
  const candidateDrivers: { name: string; weight: number }[] = []

  // 1. Official IMD Weather Alerts
  let highestAlertSeverity: 'red' | 'orange' | 'yellow' | 'green' | undefined
  let officialAlertTitle: string | undefined

  if (alerts.length > 0) {
    const severities = alerts.map((a) => a.severity.toLowerCase())
    if (severities.includes('red')) {
      highestAlertSeverity = 'red'
      score += 42
      candidateDrivers.push({ name: 'OFFICIAL SEVERE WARNING (RED)', weight: 42 })
    } else if (severities.includes('orange')) {
      highestAlertSeverity = 'orange'
      score += 32
      candidateDrivers.push({ name: 'OFFICIAL WARNING (ORANGE)', weight: 32 })
    } else if (severities.includes('yellow')) {
      highestAlertSeverity = 'yellow'
      score += 20
      candidateDrivers.push({ name: 'OFFICIAL ALERT (YELLOW)', weight: 20 })
    }

    const firstAlert = alerts[0]
    if (firstAlert) {
      officialAlertTitle = firstAlert.title
    }
  }

  // 2. Precipitation & Thunderstorms
  const conditionLower = (current.condition || '').toLowerCase()
  const isThunderstorm =
    conditionLower.includes('thunder') || conditionLower.includes('storm')
  const isHeavyRain =
    conditionLower.includes('heavy rain') ||
    conditionLower.includes('downpour') ||
    conditionLower.includes('torrential')

  if (isThunderstorm) {
    score += 24
    candidateDrivers.push({ name: 'THUNDERSTORM CONDITIONS', weight: 24 })
  } else if (isHeavyRain) {
    score += 20
    candidateDrivers.push({ name: 'HEAVY RAIN EXPECTED', weight: 20 })
  } else if (rainProbability >= 70 || conditionLower.includes('rain')) {
    score += 15
    candidateDrivers.push({ name: 'HIGH RAIN PROBABILITY', weight: 15 })
  } else if (rainProbability >= 40) {
    score += 8
    candidateDrivers.push({ name: 'MODERATE RAIN CHANCE', weight: 8 })
  }

  // 3. Wind Hazards
  const windKm = current.wind?.speed ?? 0
  if (windKm >= 50) {
    score += 20
    candidateDrivers.push({ name: `GALE WINDS (${Math.round(windKm)} KM/H)`, weight: 20 })
  } else if (windKm >= 35) {
    score += 12
    candidateDrivers.push({ name: `STRONG WINDS (${Math.round(windKm)} KM/H)`, weight: 12 })
  } else if (windKm >= 25) {
    score += 6
    candidateDrivers.push({ name: 'BREEZY CONDITIONS', weight: 6 })
  }

  // 4. Thermal Comfort / Extremes
  if (feelsLikeC >= 42) {
    score += 18
    candidateDrivers.push({ name: `EXTREME HEAT (FEELS ${Math.round(feelsLikeC)}°C)`, weight: 18 })
  } else if (feelsLikeC >= 38) {
    score += 12
    candidateDrivers.push({ name: `HIGH HEAT INDEX (${Math.round(feelsLikeC)}°C)`, weight: 12 })
  } else if (feelsLikeC <= 2) {
    score += 18
    candidateDrivers.push({ name: `FREEZING COLD (FEELS ${Math.round(feelsLikeC)}°C)`, weight: 18 })
  } else if (feelsLikeC <= 8) {
    score += 10
    candidateDrivers.push({ name: `CHILLY CONDITIONS (${Math.round(feelsLikeC)}°C)`, weight: 10 })
  }

  // 5. Solar Radiation / UV
  const uvVal = uv?.maxToday ?? uv?.index ?? 0
  if (uvVal >= 11) {
    score += 14
    candidateDrivers.push({ name: `EXTREME UV INDEX (${uvVal})`, weight: 14 })
  } else if (uvVal >= 8) {
    score += 9
    candidateDrivers.push({ name: `VERY HIGH UV (${uvVal})`, weight: 9 })
  } else if (uvVal >= 6) {
    score += 4
    candidateDrivers.push({ name: `ELEVATED UV (${uvVal})`, weight: 4 })
  }

  // 6. Air Quality (AQI)
  const aqiVal = airQuality?.index ?? 0
  if (aqiVal >= 301) {
    score += 22
    candidateDrivers.push({ name: `SEVERE AIR POLLUTION (AQI ${aqiVal})`, weight: 22 })
  } else if (aqiVal >= 201) {
    score += 15
    candidateDrivers.push({ name: `POOR AIR QUALITY (AQI ${aqiVal})`, weight: 15 })
  } else if (aqiVal >= 101) {
    score += 8
    candidateDrivers.push({ name: `MODERATE AQI (${aqiVal})`, weight: 8 })
  }

  // Clamp strictly between 0 and 100
  const finalScore = Math.min(100, Math.max(0, Math.round(score)))

  // Determine Level
  let level: RiskLevel = 'LOW'
  let summary = 'Current weather conditions are stable and pose minimal disruption.'

  if (finalScore >= 80) {
    level = 'VERY HIGH'
    summary = 'Severe conditions or active warnings present significant outdoor and travel disruption.'
  } else if (finalScore >= 60) {
    level = 'HIGH'
    summary = 'Heightened weather or environmental factors require active precaution and flexible plans.'
  } else if (finalScore >= 40) {
    level = 'MODERATE'
    summary = 'Moderate elements (e.g. rain window, heat, or elevated UV) may affect prolonged outdoor plans.'
  } else if (finalScore >= 20) {
    level = 'LOW'
    summary = 'Generally mild conditions with only minor elements to observe.'
  } else {
    level = 'VERY LOW'
    summary = 'Calm, favorable conditions throughout the immediate forecast.'
  }

  // Extract top 2 - 3 drivers by weight
  candidateDrivers.sort((a, b) => b.weight - a.weight)
  let topDrivers = candidateDrivers.slice(0, 3).map((d) => d.name)

  if (topDrivers.length === 0) {
    topDrivers = ['STABLE ATMOSPHERE', 'COMFORTABLE TEMPERATURES']
  }

  return {
    score: finalScore,
    level,
    drivers: topDrivers,
    summary,
    hasOfficialAlert: alerts.length > 0,
    highestAlertSeverity,
    officialAlertTitle,
  }
}
