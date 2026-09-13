import type { ActionPlanItem } from './types'
import type { WeatherAlert } from '@/lib/alerts/types'
import type { CurrentConditions, AirQualityData, UVData, HourlyEntry } from '@/lib/types'

interface ActionPlanInput {
  current: CurrentConditions
  feelsLikeC: number
  hourly: HourlyEntry[]
  airQuality?: AirQualityData
  uv?: UVData
  alerts?: WeatherAlert[]
  peakRainProbability?: number
}

export function computeActionPlan({
  current,
  feelsLikeC,
  hourly,
  airQuality,
  uv,
  alerts = [],
  peakRainProbability = 0,
}: ActionPlanInput): ActionPlanItem[] {
  const candidateActions: ActionPlanItem[] = []
  const condLower = (current.condition || '').toLowerCase()
  const aqiVal = airQuality?.index ?? 50
  const uvVal = uv?.maxToday ?? uv?.index ?? 0
  const windKm = current.wind?.speed ?? 0

  // 1. Official Alert Precautions (Highest Priority: Priority 1)
  if (alerts.length > 0) {
    const highest = alerts[0]
    candidateActions.push({
      id: 'official-alert',
      priority: 1,
      category: 'ALERT',
      title: 'MONITOR OFFICIAL WARNING',
      description: `Active IMD ${highest.severity.toUpperCase()} alert: ${highest.title}. Maintain awareness and plan indoors if storm develops.`,
      badgeText: 'OFFICIAL ADVISORY',
    })
  }

  // 2. Severe Storm or Heavy Rain (Priority 2)
  const isThunderstorm =
    condLower.includes('thunder') || condLower.includes('storm')
  if (isThunderstorm) {
    candidateActions.push({
      id: 'thunderstorm-prep',
      priority: 2,
      category: 'RAIN',
      title: 'KEEP PLANS FLEXIBLE',
      description: 'Thunderstorm activity detected in the area. Secure loose outdoor objects and stay away from open fields.',
      badgeText: 'STORM CAUTION',
    })
  } else if (peakRainProbability >= 60 || condLower.includes('rain')) {
    // Look up rain onset time from hourly
    const onset = hourly.find((h) => {
      const p = parseInt(h.rainProbability?.replace('%', '') || '0', 10) || 0
      return p >= 50
    })
    const onsetLabel = onset ? ` around ${onset.time}` : ' today'
    candidateActions.push({
      id: 'umbrella-prep',
      priority: 3,
      category: 'RAIN',
      title: 'CARRY AN UMBRELLA',
      description: `Precipitation probability peaks${onsetLabel} (${peakRainProbability}% chance). Carry waterproof protection.`,
      badgeText: 'RAIN PREP',
    })
  } else if (peakRainProbability >= 35) {
    candidateActions.push({
      id: 'light-rain-prep',
      priority: 6,
      category: 'RAIN',
      title: 'EXPECT SCATTERED SHOWERS',
      description: `Passing showers possible (${peakRainProbability}% probability). A compact umbrella is recommended for errands.`,
      badgeText: 'PASSING SHOWERS',
    })
  }

  // 3. Air Quality Health Precautions (Priority 3)
  if (aqiVal >= 250) {
    candidateActions.push({
      id: 'air-quality-mask',
      priority: 3,
      category: 'AIR',
      title: 'LIMIT OUTDOOR EXERTION',
      description: `AQI is elevated (${aqiVal}). Sensitive groups and joggers should move workouts indoors or wear an N95 mask.`,
      badgeText: 'CLEAN AIR ADVICE',
    })
  } else if (aqiVal >= 150) {
    candidateActions.push({
      id: 'air-quality-sensitive',
      priority: 5,
      category: 'AIR',
      title: 'VENTILATE DURING MIDDAY',
      description: `Moderate air pollution (${aqiVal}). Open windows when wind speeds facilitate air exchange.`,
      badgeText: 'AIR QUALITY',
    })
  }

  // 4. Heat Index / Thermal Comfort (Priority 4)
  if (feelsLikeC >= 39) {
    candidateActions.push({
      id: 'heat-hydration',
      priority: 4,
      category: 'HEAT',
      title: 'HYDRATE & WEAR BREATHABLE WEAR',
      description: `Heat index feels like ${Math.round(feelsLikeC)}°C. Drink electrolyte-rich fluids and avoid strenuous unshaded work.`,
      badgeText: 'HIGH HEAT',
    })
  } else if (feelsLikeC <= 5) {
    candidateActions.push({
      id: 'cold-layering',
      priority: 4,
      category: 'HEAT',
      title: 'DRESS IN THERMAL LAYERS',
      description: `Chilly conditions (feels ${Math.round(feelsLikeC)}°C). Wear wind-resistant outer clothing for early morning transit.`,
      badgeText: 'COLD WEATHER',
    })
  }

  // 5. UV Radiation Protection (Priority 5)
  if (uvVal >= 8) {
    candidateActions.push({
      id: 'uv-sunscreen',
      priority: 5,
      category: 'UV',
      title: 'APPLY SPF 30+ SUNSCREEN',
      description: `UV Index peaks at ${uvVal} (Very High). Wear sunglasses and seek shade during peak midday hours (11 AM – 3 PM).`,
      badgeText: 'SOLAR DEFENSE',
    })
  } else if (uvVal >= 6) {
    candidateActions.push({
      id: 'uv-sunglasses',
      priority: 6,
      category: 'UV',
      title: 'PLAN OUTDOOR TIME WISELY',
      description: `Moderate-high UV (${uvVal}). Direct sunlight exposure over 30 minutes warrants basic sun protection.`,
      badgeText: 'UV WATCH',
    })
  }

  // 6. Wind Precautions (Priority 6)
  if (windKm >= 38) {
    candidateActions.push({
      id: 'wind-precautions',
      priority: 6,
      category: 'COMMUTE',
      title: 'WATCH FOR WIND GUSTS',
      description: `Brisk winds up to ${Math.round(windKm)} km/h. Exercise care when cycling, riding two-wheelers, or handling umbrellas.`,
      badgeText: 'GUSTY WINDS',
    })
  }

  // Fallback for Calm/Favorable Days
  if (candidateActions.length === 0) {
    candidateActions.push({
      id: 'stable-outdoors',
      priority: 7,
      category: 'GENERAL',
      title: 'GREAT DAY FOR OUTDOORS',
      description: 'Atmospheric conditions, air quality, and temperatures are calm and comfortable for walking and travel.',
      badgeText: 'OPTIMAL CONDITIONS',
    })
    candidateActions.push({
      id: 'routine-plans',
      priority: 8,
      category: 'GENERAL',
      title: 'NO WEATHER DISRUPTIONS',
      description: 'Proceed with standard commute and daily activities without weather-related delays.',
      badgeText: 'CLEAR SKIES',
    })
  }

  // Sort candidate actions by priority ascending (1 is most urgent) and take up to 3
  candidateActions.sort((a, b) => a.priority - b.priority)
  return candidateActions.slice(0, 3)
}
