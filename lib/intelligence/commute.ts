import type { CommuteGuidanceData, CommuteState } from './types'
import type { WeatherAlert } from '@/lib/alerts/types'
import type { CurrentConditions, HourlyEntry } from '@/lib/types'

interface CommuteCalculatorInput {
  current: CurrentConditions
  hourly: HourlyEntry[]
  alerts?: WeatherAlert[]
}

export function computeCommuteGuidance({
  current,
  hourly,
  alerts = [],
}: CommuteCalculatorInput): CommuteGuidanceData {
  const condLower = (current.condition || '').toLowerCase()
  const windKm = current.wind?.speed ?? 0
  const visKm = current.visibility ?? 10

  const hasSevereAlert = alerts.some(
    (a) => a.severity.toLowerCase() === 'red' || a.severity.toLowerCase() === 'orange'
  )

  const isThunderstorm =
    condLower.includes('thunder') || condLower.includes('storm')
  const isHeavyRain =
    condLower.includes('heavy rain') || condLower.includes('downpour')

  // Check near-term commute hours (next 4-6 hours)
  const nearHours = hourly.slice(0, 6)
  const peakProb = nearHours.reduce((max, h) => {
    const prob = parseInt(h.rainProbability?.replace('%', '') || '0', 10) || 0
    return Math.max(max, prob)
  }, 0)

  // 1. DIFFICULT State
  if (hasSevereAlert || isThunderstorm || (isHeavyRain && peakProb >= 60) || visKm <= 1.5 || windKm >= 55) {
    let details = 'Severe weather and heavy precipitation may cause waterlogging or poor visibility.'
    if (visKm <= 1.5) {
      details = 'Low visibility (under 2 km) significantly impacts road conditions.'
    } else if (hasSevereAlert) {
      details = 'An active meteorological alert warns of hazardous travel conditions.'
    }

    return {
      state: 'DIFFICULT',
      headline: 'Weather may cause noticeable travel disruptions.',
      details,
      impactWindow: 'Next 3–6 hours',
    }
  }

  // 2. WATCH OUT State
  if (peakProb >= 40 || condLower.includes('rain') || windKm >= 32 || visKm <= 4) {
    return {
      state: 'WATCH OUT',
      headline: 'Rain or wet roads may slow transit.',
      details: 'Wet pavement and intermittent showers will likely cause moderate slowdowns.',
      impactWindow: 'Upcoming hours',
    }
  }

  // 3. SMOOTH State
  return {
    state: 'SMOOTH',
    headline: 'Low disruption expected from weather.',
    details: 'Roadways and transit corridors are clear of major atmospheric obstacles.',
    impactWindow: 'Throughout the day',
  }
}
