/**
 * Deterministic Weather Insight Engine — Phase 3B
 *
 * Transforms live weather, AQI, UV, and IMD official alert data into actionable,
 * time-aware decision-support answering:
 * 1. WHAT is happening?
 * 2. WHY does it matter?
 * 3. WHAT should the user do?
 *
 * Strict ₹0 recurring-cost requirement (no external LLM/AI APIs).
 * Pure deterministic synthesis with zero fabricated causation.
 */

import type {
  CurrentConditions,
  HourlyEntry,
  DailyEntry,
  AirQualityData,
  UVData,
  TemperatureUnit,
} from './types'
import type { WeatherAlert } from './alerts/types'

export type InsightCategory =
  | 'ALERT'
  | 'RAIN'
  | 'HEAT'
  | 'COLD'
  | 'UV'
  | 'AIR_QUALITY'
  | 'WIND'
  | 'STABLE'

export type InsightPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export interface TodayInsight {
  category: InsightCategory
  headline: string
  headingEmphasis?: string
  explanation: string
  recommendation?: string
  priority: InsightPriority
  icon: 'alert' | 'rain' | 'sun' | 'wind' | 'shield' | 'check' | 'cloud'
  // Backward compatibility fields for legacy InsightData
  heading: string
  description: string
  rainChance: string
  wind: string
}

export interface GenerateInsightParams {
  currentConditions: CurrentConditions
  hourly: HourlyEntry[]
  weekly: DailyEntry[]
  airQuality?: AirQualityData | null
  uv?: UVData | null
  alerts?: WeatherAlert[] | null
  timezone?: string
  city?: string
  unit?: TemperatureUnit
  rawCelsiuses?: {
    temp: number
    feelsLike: number
    high: number
    low: number
  }
}

/**
 * Transparent, well-documented thresholds for decision-support synthesis.
 */
export const INSIGHT_THRESHOLDS = {
  // Rain thresholds (%)
  rainProbHigh: 50, // 50%+ probability requires active planning
  rainProbModerate: 35, // 35-49% chance of spotty showers
  rainProbLow: 15, // <= 15% clear window

  // Temperature thresholds (°C)
  heatSevere: 38, // Severe heat requiring safety precautions
  heatHigh: 34, // High daytime temperature
  heatFeelsLikeDiff: 4, // Apparent temperature is 4°C+ higher than thermometer
  coldSevere: 10, // Cold requiring heavy protection
  coldChilly: 15, // Noticeably chilly/cool

  // UV thresholds
  uvVeryHigh: 8, // Very high UV (8+)
  uvHigh: 6, // High UV (6-7)

  // Air Quality thresholds
  aqiPoor: 150, // Unhealthy for general population (150+)
  aqiModerateElevated: 100, // Moderate / Sensitive group advisory (100-149)
  pm25Elevated: 60, // Elevated PM2.5 concentration (ug/m3)
  pm10Elevated: 100, // Elevated PM10 concentration (ug/m3)

  // Wind thresholds (km/h)
  windGale: 45, // Gale/gusts requiring safety attention
  windBreezy: 28, // Brisk breeze
} as const

/**
 * Get current hour (0-23) in the target city's timezone.
 */
function getLocalHour(timezone?: string): number {
  try {
    const tz = timezone || 'UTC'
    const str = new Date().toLocaleTimeString('en-US', {
      timeZone: tz,
      hour12: false,
      hour: 'numeric',
    })
    const h = parseInt(str, 10)
    return isNaN(h) ? new Date().getHours() : h
  } catch {
    return new Date().getHours()
  }
}

/**
 * Deterministic Insight Generator
 */
export function generateTodayInsight({
  currentConditions,
  hourly = [],
  weekly = [],
  airQuality,
  uv,
  alerts = [],
  timezone = 'auto',
  city = 'Local',
  unit = '°C',
  rawCelsiuses,
}: GenerateInsightParams): TodayInsight {
  const localHour = getLocalHour(timezone)
  const isMorning = localHour >= 5 && localHour < 12
  const isAfternoon = localHour >= 12 && localHour < 17
  const isEvening = localHour >= 17 && localHour < 21
  const isNight = localHour >= 21 || localHour < 5

  // Normalize base temperatures in Celsius for threshold evaluation
  const tempC =
    rawCelsiuses?.temp ??
    (unit === '°F'
      ? Math.round(((currentConditions?.temperature ?? 77) - 32) * (5 / 9))
      : currentConditions?.temperature ?? 25)

  const feelsLikeC =
    rawCelsiuses?.feelsLike ??
    (unit === '°F'
      ? Math.round(((currentConditions?.feelsLike ?? currentConditions?.temperature ?? 77) - 32) * (5 / 9))
      : currentConditions?.feelsLike ?? tempC)

  const highC =
    rawCelsiuses?.high ??
    (unit === '°F'
      ? Math.round(((currentConditions?.high ?? currentConditions?.temperature ?? 77) - 32) * (5 / 9))
      : currentConditions?.high ?? tempC)

  const lowC =
    rawCelsiuses?.low ??
    (unit === '°F'
      ? Math.round(((currentConditions?.low ?? currentConditions?.temperature ?? 77) - 32) * (5 / 9))
      : currentConditions?.low ?? tempC)

  const windSpeed = currentConditions?.wind?.speed ?? 0

  // Formatter for user-facing text respecting unit preference
  const formatT = (c: number): string => {
    if (unit === '°F') {
      return `${Math.round(c * (9 / 5) + 32)}°F`
    }
    return `${Math.round(c)}°C`
  }

  // Inspect upcoming hourly rain probabilities
  const hourlyProbs = hourly.map((h) => {
    const parsed = parseInt(h.rainProbability, 10)
    return isNaN(parsed) ? 0 : parsed
  })

  // Look ahead over next 6-8 hours
  const upcomingProbs = hourlyProbs.slice(0, 8)
  const maxUpcomingProb = upcomingProbs.length > 0 ? Math.max(...upcomingProbs) : 0
  const peakProbIndex = upcomingProbs.indexOf(maxUpcomingProb)
  const peakHourEntry = peakProbIndex >= 0 && hourly[peakProbIndex] ? hourly[peakProbIndex].time : ''

  const generalRainStr = `${maxUpcomingProb}%`
  const windStr = `${windSpeed} km/h`

  // =========================================================================
  // RULE A: ACTIVE OFFICIAL IMD ALERT (Top Priority)
  // =========================================================================
  const activeAlert = alerts && alerts.length > 0 ? alerts[0] : null
  if (activeAlert) {
    const alertSeverity = activeAlert.severity
    const alertTitle = activeAlert.title.toUpperCase()
    const alertArea = activeAlert.area || city

    if (alertSeverity === 'EXTREME') {
      const headline = 'OFFICIAL IMD WARNING ACTIVE'
      const headingEmphasis = alertTitle
      const explanation = `An official IMD warning is active for ${activeAlert.title.toLowerCase()} in ${alertArea}.`
      const recommendation =
        'Follow official civil directives, monitor live radar, and avoid non-essential travel while the warning is in effect.'

      return {
        category: 'ALERT',
        headline,
        headingEmphasis,
        explanation,
        recommendation,
        priority: 'HIGH',
        icon: 'alert',
        heading: headline,
        description: `${explanation} ${recommendation}`,
        rainChance: generalRainStr,
        wind: windStr,
      }
    }

    if (alertSeverity === 'SEVERE') {
      const headline = 'OFFICIAL IMD ALERT ACTIVE'
      const headingEmphasis = alertTitle
      const explanation = `An official IMD alert is active for ${activeAlert.title.toLowerCase()} in ${alertArea}.`
      const recommendation =
        'Monitor official IMD updates and live radar closely if planning outdoor travel.'

      return {
        category: 'ALERT',
        headline,
        headingEmphasis,
        explanation,
        recommendation,
        priority: 'HIGH',
        icon: 'alert',
        heading: headline,
        description: `${explanation} ${recommendation}`,
        rainChance: generalRainStr,
        wind: windStr,
      }
    }

    if (alertSeverity === 'MODERATE') {
      const headline = 'OFFICIAL IMD WATCH ACTIVE'
      const headingEmphasis = alertTitle
      const explanation = `An official IMD watch is active for ${activeAlert.title.toLowerCase()} in ${alertArea}.`
      const recommendation =
        'Monitor live radar and keep track of official IMD updates if heading outdoors.'

      return {
        category: 'ALERT',
        headline,
        headingEmphasis,
        explanation,
        recommendation,
        priority: 'HIGH',
        icon: 'alert',
        heading: headline,
        description: `${explanation} ${recommendation}`,
        rainChance: generalRainStr,
        wind: windStr,
      }
    }

    // Default / Minor / Advisory
    const headline = 'OFFICIAL IMD ADVISORY'
    const headingEmphasis = alertTitle
    const explanation = `An official IMD advisory is active for ${activeAlert.title.toLowerCase()} in ${alertArea}.`
    const recommendation =
      'Stay informed with local weather updates and check live radar before heading outdoors.'

    return {
      category: 'ALERT',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'HIGH',
      icon: 'alert',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // =========================================================================
  // RULE B: SIGNIFICANT PRECIPITATION
  // =========================================================================
  if (maxUpcomingProb >= INSIGHT_THRESHOLDS.rainProbHigh) {
    let timingPhrase = 'today'
    if (isNight) {
      timingPhrase = 'overnight'
    } else if (peakProbIndex === 0 || peakProbIndex === 1) {
      timingPhrase = 'within the next 1–2 hours'
    } else if (isMorning && peakProbIndex >= 3 && peakProbIndex <= 6) {
      timingPhrase = 'this afternoon'
    } else if (isAfternoon && peakProbIndex >= 2) {
      timingPhrase = 'this evening'
    } else if (isEvening) {
      timingPhrase = 'tonight'
    } else if (peakHourEntry) {
      timingPhrase = `around ${peakHourEntry}`
    }

    const headline =
      maxUpcomingProb >= 75
        ? 'HEAVY RAIN HIGHLY LIKELY'
        : 'RAIN PROBABLE AHEAD'
    const headingEmphasis = `Precipitation peaks ${timingPhrase}`
    const explanation = `Rain probability peaks at ${maxUpcomingProb}% ${timingPhrase}. Showers or thunderstorm activity could cause localized waterlogging and low road visibility.`
    const recommendation = isNight
      ? 'Secure outdoor belongings, keep windows closed, and prepare for wet morning roads.'
      : 'Carry waterproof gear and allow extra transit time for your upcoming commutes.'

    return {
      category: 'RAIN',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'HIGH',
      icon: 'rain',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // =========================================================================
  // RULE C: EXTREME / ELEVATED TEMPERATURE & HEAT INDEX
  // =========================================================================
  if (highC >= INSIGHT_THRESHOLDS.heatSevere || feelsLikeC >= 40) {
    const headline = 'HIGH HEAT INDEX ADVISORY'
    const headingEmphasis = `Feels like ${formatT(feelsLikeC)}`
    const explanation = `Air temperature peaks at ${formatT(highC)}, but high moisture levels make conditions feel like ${formatT(feelsLikeC)}. Prolonged direct sun exposure poses heat fatigue risk.`
    const recommendation =
      'Drink water frequently, wear light breathable clothing, and stay out of direct midday sun.'

    return {
      category: 'HEAT',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'HIGH',
      icon: 'sun',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  if (highC >= INSIGHT_THRESHOLDS.heatHigh && (feelsLikeC - tempC >= INSIGHT_THRESHOLDS.heatFeelsLikeDiff)) {
    const headline = 'ELEVATED HUMIDITY & HEAT'
    const headingEmphasis = `Feels warmer at ${formatT(feelsLikeC)}`
    const explanation = `While the thermometer reads ${formatT(tempC)}, humid atmospheric conditions raise apparent temperatures to ${formatT(feelsLikeC)}.`
    const recommendation =
      'Hydrate well and prefer well-ventilated or air-conditioned indoor environments during the afternoon.'

    return {
      category: 'HEAT',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'MEDIUM',
      icon: 'sun',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  if (lowC <= INSIGHT_THRESHOLDS.coldSevere || (isNight && tempC <= INSIGHT_THRESHOLDS.coldSevere)) {
    const headline = isNight ? 'NOTICEABLE CHILL TONIGHT' : 'BRISK COLD CONDITIONS'
    const headingEmphasis = `Lows dropping to ${formatT(lowC)}`
    const explanation = `Cold air settles over the district with temperatures dipping down to ${formatT(lowC)}. Morning commuters will experience brisk cold.`
    const recommendation =
      'Layer up warmly, especially if travelling early morning or on two-wheelers.'

    return {
      category: 'COLD',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'MEDIUM',
      icon: 'cloud',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // =========================================================================
  // RULE D: UV RADIATION (Active during daylight hours)
  // =========================================================================
  const uvMax = uv?.maxToday ?? uv?.index ?? 0
  const isDaylight = !isNight && localHour >= 9 && localHour <= 16

  if (isDaylight && uvMax >= INSIGHT_THRESHOLDS.uvVeryHigh) {
    const headline = `VERY HIGH UV RADIATION (${uvMax})`
    const headingEmphasis = 'Peak Sun Protection Needed'
    const explanation = `Solar UV radiation reaches a very high index of ${uvMax} during midday hours. Unprotected skin can experience sunburn in under 20 minutes.`
    const recommendation =
      'Wear UV-blocking sunglasses, apply broad-spectrum sunscreen, and seek shade between 11 AM and 3 PM.'

    return {
      category: 'UV',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'HIGH',
      icon: 'sun',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // =========================================================================
  // RULE E: AIR QUALITY (Respect CPCB ground station vs Modeled)
  // =========================================================================
  const aqiIndex = airQuality?.index ?? null
  const isCpcb = airQuality?.standard === 'CPCB' || airQuality?.sourceType === 'GROUND_STATION'
  const sourceLabel = isCpcb ? 'CPCB' : 'Modeled'

  if (aqiIndex && aqiIndex >= INSIGHT_THRESHOLDS.aqiPoor) {
    const pollutantNote = airQuality?.prominentPollutant
      ? `driven primarily by ${airQuality.prominentPollutant}`
      : airQuality?.pm25 && airQuality.pm25 >= INSIGHT_THRESHOLDS.pm25Elevated
      ? `with PM2.5 at ${Math.round(airQuality.pm25)} µg/m³`
      : 'with elevated particulate matter'

    const headline = `POOR AIR QUALITY (${sourceLabel} ${aqiIndex})`
    const headingEmphasis = `${airQuality?.level || 'Unhealthy'} Range`
    const explanation = `${sourceLabel} AQI is elevated at ${aqiIndex}, ${pollutantNote}. Atmospheric dispersion is limited across the region today.`
    const recommendation =
      'Limit prolonged outdoor exertion and consider wearing a protective mask along busy roadways.'

    return {
      category: 'AIR_QUALITY',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'HIGH',
      icon: 'shield',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // =========================================================================
  // RULE F: WIND
  // =========================================================================
  if (windSpeed >= INSIGHT_THRESHOLDS.windGale) {
    const headline = 'STRONG GUSTY WINDS'
    const headingEmphasis = `Sustained at ${windSpeed} km/h`
    const explanation = `Brisk winds gusting up to ${windSpeed} km/h are affecting the area. May stir up dust and affect high-profile vehicles on highways.`
    const recommendation =
      'Secure loose outdoor items and exercise caution near construction sites or tall trees.'

    return {
      category: 'WIND',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'MEDIUM',
      icon: 'wind',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // Secondary Tier: Moderate Rain Chance (35-49%)
  if (maxUpcomingProb >= INSIGHT_THRESHOLDS.rainProbModerate) {
    const headline = 'SCATTERED SHOWERS POSSIBLE'
    const headingEmphasis = `Up to ${maxUpcomingProb}% chance`
    const explanation = `Isolated showers are possible during the day with a ${maxUpcomingProb}% chance. Rain will likely be intermittent rather than a persistent downpour.`
    const recommendation =
      'Keep a portable umbrella handy just in case passing clouds gather overhead.'

    return {
      category: 'RAIN',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'MEDIUM',
      icon: 'rain',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // Secondary Tier: Comparative Synthesis when Air Quality is the Main Factor
  if (aqiIndex && aqiIndex >= INSIGHT_THRESHOLDS.aqiModerateElevated) {
    const headline = 'AIR QUALITY IS THE MAIN FACTOR'
    const headingEmphasis = `${sourceLabel} AQI ${aqiIndex}`
    const explanation = `${sourceLabel} AQI is ${aqiIndex} while weather conditions remain mild and rain probability stays low at ${maxUpcomingProb}%. The primary factor for outdoor plans today is ambient air quality rather than weather.`
    const recommendation =
      'Sensitive individuals should consider moderating intense outdoor workouts.'

    return {
      category: 'AIR_QUALITY',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'LOW',
      icon: 'shield',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // Secondary Tier: Daylight High UV (Index 6–7)
  if (isDaylight && uvMax >= INSIGHT_THRESHOLDS.uvHigh) {
    const headline = `MODERATE-HIGH UV (${uvMax})`
    const headingEmphasis = 'Midday Sun Awareness'
    const explanation = `UV index reaches ${uvMax} around midday. Sun protection is recommended during peak daylight hours.`
    const recommendation =
      'Wear sunglasses and apply sunscreen if spending more than 30 minutes in direct sunlight.'

    return {
      category: 'UV',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'LOW',
      icon: 'sun',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // Secondary Tier: Breezy wind (28+ km/h)
  if (windSpeed >= INSIGHT_THRESHOLDS.windBreezy) {
    const headline = 'BREEZY CONDITIONS'
    const headingEmphasis = `Wind at ${windSpeed} km/h`
    const explanation = `A noticeable breeze of ${windSpeed} km/h is moving across the area, bringing cooler air movement.`
    const recommendation =
      'Favorable for outdoor walks; secure light paper or lightweight items outdoors.'

    return {
      category: 'WIND',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'LOW',
      icon: 'wind',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  // =========================================================================
  // RULE G: CALM / STABLE CONDITIONS (Deterministic synthesis)
  // =========================================================================
  const tempBandDiff =
    unit === '°F'
      ? Math.round(highC * (9 / 5) + 32) - Math.round(lowC * (9 / 5) + 32)
      : Math.abs(highC - lowC)
  const diffUnitStr = unit === '°F' ? `${tempBandDiff}°F` : `${tempBandDiff}°C`

  if (isNight) {
    const headline = 'OVERNIGHT WEATHER STABLE'
    const headingEmphasis = `${currentConditions?.condition || 'Clear Skies'}`
    const explanation = `Temperatures settle around ${formatT(tempC)} overnight under calm atmospheric conditions with negligible rain risk (${maxUpcomingProb}%).`
    const recommendation =
      'Restful overnight conditions ahead with no adverse weather developments expected.'

    return {
      category: 'STABLE',
      headline,
      headingEmphasis,
      explanation,
      recommendation,
      priority: 'LOW',
      icon: 'check',
      heading: headline,
      description: `${explanation} ${recommendation}`,
      rainChance: generalRainStr,
      wind: windStr,
    }
  }

  const headline = 'CALM & STABLE CONDITIONS'
  const headingEmphasis = `${currentConditions?.condition || 'Clear Skies'}`
  const explanation = `Weather parameters remain calm today. Temperatures fluctuate within a steady ${diffUnitStr} band (${formatT(lowC)} to ${formatT(highC)}) with low rain risk (${maxUpcomingProb}%).`
  const recommendation =
    'Great window for outdoor activities, commutes, and daily routines.'

  return {
    category: 'STABLE',
    headline,
    headingEmphasis,
    explanation,
    recommendation,
    priority: 'LOW',
    icon: 'check',
    heading: headline,
    description: `${explanation} ${recommendation}`,
    rainChance: generalRainStr,
    wind: windStr,
  }
}
