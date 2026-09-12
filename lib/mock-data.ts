/**
 * Mock data extracted from the v0-generated page.tsx.
 * Every value here was previously hardcoded inline in JSX.
 * When real APIs are connected, this file becomes the fallback/seed data.
 */

import type {
  HourlyEntry,
  DailyEntry,
  CityWeather,
  CurrentConditions,
  AirQualityData,
  UVData,
  LocationData,
  InsightData,
  SearchSuggestion,
} from './types'

export const mockHourlyForecast: HourlyEntry[] = [
  { time: '14:00', temperature: '31°', rainProbability: '10%', iconType: 'sun' },
  { time: '15:00', temperature: '30°', rainProbability: '20%', iconType: 'cloud' },
  { time: '16:00', temperature: '29°', rainProbability: '68%', iconType: 'rain' },
  { time: '17:00', temperature: '29°', rainProbability: '72%', iconType: 'rain' },
  { time: '18:00', temperature: '28°', rainProbability: '64%', iconType: 'storm' },
  { time: '19:00', temperature: '27°', rainProbability: '51%', iconType: 'cloud' },
  { time: '20:00', temperature: '27°', rainProbability: '34%', iconType: 'cloud' },
  { time: '21:00', temperature: '26°', rainProbability: '18%', iconType: 'sun' },
  { time: '22:00', temperature: '26°', rainProbability: '12%', iconType: 'sun' },
  { time: '23:00', temperature: '25°', rainProbability: '10%', iconType: 'cloud' },
]

export const mockWeeklyForecast: DailyEntry[] = [
  { day: 'MON', high: '33°', low: '26°', rainProbability: '12%', iconType: 'sun' },
  { day: 'TUE', high: '31°', low: '25°', rainProbability: '55%', iconType: 'rain' },
  { day: 'WED', high: '32°', low: '26°', rainProbability: '38%', iconType: 'cloud' },
  { day: 'THU', high: '30°', low: '24°', rainProbability: '72%', iconType: 'storm' },
  { day: 'FRI', high: '32°', low: '25°', rainProbability: '22%', iconType: 'sun' },
  { day: 'SAT', high: '31°', low: '25°', rainProbability: '40%', iconType: 'cloud' },
  { day: 'SUN', high: '33°', low: '26°', rainProbability: '18%', iconType: 'sun' },
]

export const mockCities: CityWeather[] = [
  { city: 'Kolkata', country: 'India', temperature: '31°', description: 'Partly cloudy', iconType: 'cloud', colorClass: 'city-blue' },
  { city: 'Delhi', country: 'India', temperature: '34°', description: 'Clear skies', iconType: 'sun', colorClass: 'city-lavender' },
  { city: 'Mumbai', country: 'India', temperature: '29°', description: 'Light rain', iconType: 'rain', colorClass: 'city-yellow' },
  { city: 'London', country: 'UK', temperature: '16°', description: 'Overcast', iconType: 'cloud', colorClass: 'city-cyan' },
]

export const mockCurrentConditions: CurrentConditions = {
  condition: 'PARTLY CLOUDY',
  temperature: 31,
  feelsLike: 35,
  high: 33,
  low: 26,
  sunrise: '5:42 AM',
  sunset: '6:03 PM',
  humidity: 78,
  seasonNote: 'MONSOON SEASON',
  date: 'THU / 18 SEP 2025',
  iconType: 'cloud',
  wind: { speed: 14, direction: 'South east' },
  visibility: 8.2,
  pressure: 1008,
}

export const mockAirQuality: AirQualityData = {
  index: 86,
  standard: 'US',
  sourceType: 'ATMOSPHERIC_MODEL',
  sourceName: 'Copernicus CAMS Model',
  level: 'MODERATE',
  pm25: 34,
  pm10: 61,
  o3: 42,
  no2: 18,
  timestamp: '2026-09-12T13:00:00Z',
  isFallback: false,
}

export const mockUV: UVData = {
  index: 7,
  maxToday: 8,
  level: 'HIGH',
  advice: 'Protection recommended. Limit direct sun exposure between 11 AM — 3 PM.',
}

export const mockLocation: LocationData = {
  city: 'KOLKATA',
  country: 'INDIA',
  localTime: '14:02',
  lastUpdated: 'JUST NOW',
}

export const mockInsight: InsightData = {
  heading: 'Best outdoor window',
  headingEmphasis: 'before 10 AM.',
  description: 'Temperature is mild and air quality is healthy. Rain probability rises significantly after 3 PM.',
  rainChance: '78%',
  wind: '7.9 km/h',
}

export const mockSearchSuggestions: SearchSuggestion[] = [
  { city: 'KOLKATA', country: 'INDIA', temperature: '31°' },
  { city: 'DELHI', country: 'INDIA', temperature: '34°' },
]
