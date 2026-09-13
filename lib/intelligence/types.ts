import type { TemperatureUnit } from '@/lib/types'
import type { WeatherAlert } from '@/lib/alerts/types'

export type RiskLevel = 'VERY LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH'
export type OutdoorState = 'GOOD' | 'CAUTION' | 'NOT IDEAL' | 'AVOID'
export type CommuteState = 'SMOOTH' | 'WATCH OUT' | 'DIFFICULT'
export type RainTimingStatus = 'NO_RAIN' | 'RAIN_ONGOING' | 'RAIN_UPCOMING' | 'RAIN_POSSIBLE'
export type HeatUvLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH'
export type AirWeatherLevel = 'GOOD' | 'MODERATE' | 'UNHEALTHY_SENSITIVE' | 'UNHEALTHY' | 'HAZARDOUS'
export type ActionCategory = 'ALERT' | 'RAIN' | 'AIR' | 'UV' | 'HEAT' | 'COMMUTE' | 'GENERAL'

export interface WeatherRiskData {
  score: number // 0 - 100
  level: RiskLevel
  drivers: string[] // 2 - 3 key drivers
  summary: string
  hasOfficialAlert: boolean
  highestAlertSeverity?: 'red' | 'orange' | 'yellow' | 'green'
  officialAlertTitle?: string
}

export interface OutdoorGuidanceData {
  state: OutdoorState
  headline: string
  details: string
  keyFactor: string
}

export interface CommuteGuidanceData {
  state: CommuteState
  headline: string
  details: string
  impactWindow?: string
}

export interface RainTimingData {
  status: RainTimingStatus
  headline: string
  details: string
  peakProbability: number // 0 - 100
  peakTimeLabel?: string
  easingTimeLabel?: string
  intensityLabel?: string
}

export interface HeatUvGuidanceData {
  level: HeatUvLevel
  headline: string
  details: string
  uvIndex: number
  feelsLikeC: number
  isDaytime: boolean
}

export interface AirWeatherGuidanceData {
  level: AirWeatherLevel
  headline: string
  details: string
  aqi: number
  sourceType: 'CPCB Ground Station' | 'Atmospheric Model'
  dominantPollutant?: string
  windInteraction: string
}

export interface ActionPlanItem {
  id: string
  priority: number // 1 to 3
  category: ActionCategory
  title: string
  description: string
  badgeText?: string
}

export interface WeatherIntelligenceData {
  risk: WeatherRiskData
  outdoor: OutdoorGuidanceData
  commute: CommuteGuidanceData
  rainTiming: RainTimingData
  heatUv: HeatUvGuidanceData
  airWeather: AirWeatherGuidanceData
  actionPlan: ActionPlanItem[]
  computedAt: string
}
