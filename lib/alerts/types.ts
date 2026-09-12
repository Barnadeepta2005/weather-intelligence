/**
 * Types for Weather Alerts and IMD Integration.
 * Extensible for future international official providers or model advisories.
 */

export type AlertSeverity = 'INFO' | 'MINOR' | 'MODERATE' | 'SEVERE' | 'EXTREME'

export type AlertSourceType = 'OFFICIAL' | 'MODEL'

export interface WeatherAlert {
  id: string
  title: string
  severity: AlertSeverity
  source: 'IMD'
  sourceType: AlertSourceType
  area: string
  districtId: string
  description: string
  issuedAt?: string
  startTime?: string
  endTime?: string
  validDate?: string
  colorHex?: string
  sourceUrl: string
  warningCode?: number
}

export interface DistrictInfo {
  id: string
  name: string
  state: string
}

export interface AlertsResponse {
  hasActiveAlerts: boolean
  district?: DistrictInfo
  alerts: WeatherAlert[]
  lastUpdated: string
  attribution: string
  isLive: boolean
  error?: string
}

export interface IMDDistrictMapping {
  id: string
  name: string
  state: string
  lat: number
  lon: number
  bbox: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
}
