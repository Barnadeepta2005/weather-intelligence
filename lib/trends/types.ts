/**
 * Types for Weather Trends & Historical Comparison (Phase 4)
 */

export type TrendRange = '7d' | '14d' | '30d'

export type TrendMode = '24h' | 'multi-day'

export type TrendMetric24h = 'temp' | 'feelsLike' | 'humidity' | 'wind' | 'precip'

export type TrendMetricDaily = 'temp' | 'rain' | 'wind' | 'uv'

export interface HistoricalHourlyPoint {
  time: string          // ISO string
  hourLabel: string     // "14:00" or "2 PM"
  temperature: number   // Raw Celsius
  apparentTemperature: number // Raw Celsius
  humidity: number      // %
  windSpeed: number     // km/h
  precipitation: number // mm
  isPast: boolean
  isCurrent: boolean
}

export interface HistoricalDailyPoint {
  date: string          // "YYYY-MM-DD"
  dayLabel: string      // "Mon 08"
  tempMax: number       // Raw Celsius
  tempMin: number       // Raw Celsius
  precipitationSum: number // mm
  windSpeedMax: number  // km/h
  uvIndexMax: number
  isToday: boolean
}

export interface MetricComparison {
  diff: number          // today - baseline
  text: string          // e.g. "+3.2° warmer", "About the same"
  status: 'warmer' | 'cooler' | 'wetter' | 'drier' | 'stronger' | 'calmer' | 'same'
  todayValue: number
  baselineAvg: number
}

export interface TodayComparison {
  temp: MetricComparison
  rain: MetricComparison
  wind: MetricComparison
  baselineDays: number
}

export interface TrendSummary {
  headline: string      // e.g. "TODAY IS RUNNING 3.2° WARMER THAN THE RECENT 7-DAY AVERAGE."
  detail: string        // Contextual breakdown
  tone: 'warm' | 'cool' | 'wet' | 'windy' | 'stable'
}

export interface WeatherTrendsData {
  latitude: number
  longitude: number
  timezone: string
  range: TrendRange
  hourly24h: HistoricalHourlyPoint[]
  daily: HistoricalDailyPoint[]
  comparison: TodayComparison
  summary: TrendSummary
  fetchedAt: string
}

export interface WeatherTrendsResponse {
  data?: WeatherTrendsData
  error?: string
  isLive?: boolean
}
