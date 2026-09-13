/** Weather icon categories mapped to Lucide icons */
export type WeatherIconType = 'sun' | 'storm' | 'rain' | 'cloud'

/** Temperature unit toggle */
export type TemperatureUnit = '°C' | '°F'

/** A single hour in the hourly forecast strip */
export interface HourlyEntry {
  time: string
  temperature: string
  rainProbability: string
  iconType: WeatherIconType
  // Detail view enriched fields
  fullTime?: string
  date?: string
  condition?: string
  feelsLike?: string
  precipitation?: string
  rain?: string
  snowfall?: string
  cloudCover?: string
  humidity?: string
  windSpeed?: string
  windDirection?: string
  pressure?: string
  visibility?: string
  uvIndex?: number
  uvLevel?: string
  sunrise?: string
  sunset?: string
  rawC?: {
    temp: number
    feelsLike: number
  }
}

/** A single day in the 7-day forecast */
export interface DailyEntry {
  day: string
  high: string
  low: string
  rainProbability: string
  iconType: WeatherIconType
  // Detail view enriched fields
  fullDate?: string
  date?: string
  condition?: string
  precipitationSum?: string
  rainSum?: string
  snowfallSum?: string
  windSpeedMax?: string
  windDirectionDominant?: string
  uvIndexMax?: number
  uvLevel?: string
  sunrise?: string
  sunset?: string
  rawC?: {
    high: number
    low: number
  }
}

/** Forecast detail modal selection state */
export type ForecastSelection =
  | { type: 'hour'; index: number }
  | { type: 'day'; index: number }
  | null

/** A saved/other city card */
export interface CityWeather {
  city: string
  country: string
  temperature: string
  description: string
  iconType: WeatherIconType
  colorClass: string
}

/** Current weather conditions for the selected location */
export interface CurrentConditions {
  condition: string
  temperature: number
  feelsLike: number
  high: number
  low: number
  sunrise: string
  sunset: string
  humidity: number
  seasonNote: string
  date: string
  iconType: WeatherIconType
  wind: { speed: number; direction: string }
  visibility: number
  pressure: number
}

/** Unified Air Quality contract */
export interface UnifiedAirQuality {
  index: number | null
  standard: 'CPCB' | 'US' | 'EUROPEAN'
  sourceType: 'GROUND_STATION' | 'ATMOSPHERIC_MODEL'
  sourceName: string
  level: string
  prominentPollutant?: string
  pm25: number | null
  pm10: number | null
  o3: number | null
  no2: number | null
  timestamp: string | null
  isFallback: boolean
  usAqi?: number
  europeanAqi?: number
}

/** Air quality index data (aliased to UnifiedAirQuality for unified modeling) */
export type AirQualityData = UnifiedAirQuality

/** UV index data */
export interface UVData {
  index: number
  maxToday?: number
  level: string
  advice: string
  timestamp?: string
}

/** Current location metadata */
export interface LocationData {
  city: string
  country: string
  admin1?: string
  localTime: string
  lastUpdated: string
}

/** Deterministic daily insight */
export interface InsightData {
  heading: string
  headingEmphasis?: string
  description: string
  rainChance: string
  wind: string
  category?: 'ALERT' | 'RAIN' | 'HEAT' | 'COLD' | 'UV' | 'AIR_QUALITY' | 'WIND' | 'STABLE'
  headline?: string
  explanation?: string
  recommendation?: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH'
  icon?: 'alert' | 'rain' | 'sun' | 'wind' | 'shield' | 'check' | 'cloud' | string
}

/** Search suggestion entry */
export interface SearchSuggestion {
  city: string
  country: string
  temperature?: string
  admin1?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

/** Geocoded location result from Open-Meteo Geocoding API */
export interface GeocodedLocation {
  id: number
  name: string
  country: string
  countryCode?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone: string
}

/** Selected location state */
export interface SelectedLocation {
  id?: number
  name: string
  country: string
  countryCode?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone: string
  source: 'SEARCH' | 'GEOLOCATION' | 'DEFAULT'
}
