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
  { time: '14:00', temperature: '31°', rainProbability: '10%', iconType: 'sun', condition: 'Sunny', fullTime: 'Today • 2:00 PM', feelsLike: '35°', precipitation: '0.0 mm', humidity: '72%', windSpeed: '12 km/h', windDirection: 'South east', uvIndex: 7.2, uvLevel: 'HIGH', pressure: '1009 hPa', visibility: '9.0 km', cloudCover: '20%', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { time: '15:00', temperature: '30°', rainProbability: '20%', iconType: 'cloud', condition: 'Partly Cloudy', fullTime: 'Today • 3:00 PM', feelsLike: '34°', precipitation: '0.1 mm', humidity: '75%', windSpeed: '14 km/h', windDirection: 'South east', uvIndex: 5.4, uvLevel: 'MODERATE', pressure: '1008 hPa', visibility: '8.5 km', cloudCover: '45%', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { time: '16:00', temperature: '29°', rainProbability: '68%', iconType: 'rain', condition: 'Showers', fullTime: 'Today • 4:00 PM', feelsLike: '33°', precipitation: '1.8 mm', humidity: '82%', windSpeed: '18 km/h', windDirection: 'South', uvIndex: 3.1, uvLevel: 'MODERATE', pressure: '1007 hPa', visibility: '6.0 km', cloudCover: '80%', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { time: '17:00', temperature: '29°', rainProbability: '72%', iconType: 'rain', condition: 'Heavy Rain', fullTime: 'Today • 5:00 PM', feelsLike: '32°', precipitation: '3.4 mm', humidity: '88%', windSpeed: '22 km/h', windDirection: 'South', uvIndex: 1.0, uvLevel: 'LOW', pressure: '1006 hPa', visibility: '4.5 km', cloudCover: '95%', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { time: '18:00', temperature: '28°', rainProbability: '64%', iconType: 'storm', condition: 'Thunderstorm', fullTime: 'Today • 6:00 PM', feelsLike: '31°', precipitation: '2.5 mm', humidity: '90%', windSpeed: '24 km/h', windDirection: 'South west', uvIndex: 0.1, uvLevel: 'LOW', pressure: '1006 hPa', visibility: '5.0 km', cloudCover: '100%', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { time: '19:00', temperature: '27°', rainProbability: '51%', iconType: 'cloud', condition: 'Overcast', fullTime: 'Today • 7:00 PM', feelsLike: '30°', precipitation: '0.4 mm', humidity: '91%', windSpeed: '16 km/h', windDirection: 'South west', uvIndex: 0.0, uvLevel: 'LOW', pressure: '1007 hPa', visibility: '7.0 km', cloudCover: '90%', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { time: '20:00', temperature: '27°', rainProbability: '34%', iconType: 'cloud', condition: 'Mostly Cloudy', fullTime: 'Today • 8:00 PM', feelsLike: '29°', precipitation: '0.1 mm', humidity: '92%', windSpeed: '14 km/h', windDirection: 'South', uvIndex: 0.0, uvLevel: 'LOW', pressure: '1008 hPa', visibility: '8.0 km', cloudCover: '70%', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { time: '21:00', temperature: '26°', rainProbability: '18%', iconType: 'sun', condition: 'Clear Skies', fullTime: 'Today • 9:00 PM', feelsLike: '28°', precipitation: '0.0 mm', humidity: '89%', windSpeed: '10 km/h', windDirection: 'South', uvIndex: 0.0, uvLevel: 'LOW', pressure: '1009 hPa', visibility: '9.5 km', cloudCover: '30%', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { time: '22:00', temperature: '26°', rainProbability: '12%', iconType: 'sun', condition: 'Clear Skies', fullTime: 'Today • 10:00 PM', feelsLike: '27°', precipitation: '0.0 mm', humidity: '87%', windSpeed: '8 km/h', windDirection: 'South east', uvIndex: 0.0, uvLevel: 'LOW', pressure: '1010 hPa', visibility: '10.0 km', cloudCover: '20%', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { time: '23:00', temperature: '25°', rainProbability: '10%', iconType: 'cloud', condition: 'Partly Cloudy', fullTime: 'Today • 11:00 PM', feelsLike: '26°', precipitation: '0.0 mm', humidity: '86%', windSpeed: '8 km/h', windDirection: 'South east', uvIndex: 0.0, uvLevel: 'LOW', pressure: '1010 hPa', visibility: '10.0 km', cloudCover: '25%', sunrise: '5:42 AM', sunset: '6:03 PM' },
]

export const mockWeeklyForecast: DailyEntry[] = [
  { day: 'MON', high: '33°', low: '26°', rainProbability: '12%', iconType: 'sun', condition: 'Mainly Clear', fullDate: 'Monday, 22 Sep 2025', precipitationSum: '0.0 mm', rainSum: '0.0 mm', snowfallSum: '0.0 cm', windSpeedMax: '16 km/h', windDirectionDominant: 'SE', uvIndexMax: 8.5, uvLevel: 'VERY HIGH', sunrise: '5:42 AM', sunset: '6:03 PM' },
  { day: 'TUE', high: '31°', low: '25°', rainProbability: '55%', iconType: 'rain', condition: 'Passing Showers', fullDate: 'Tuesday, 23 Sep 2025', precipitationSum: '4.2 mm', rainSum: '4.2 mm', snowfallSum: '0.0 cm', windSpeedMax: '22 km/h', windDirectionDominant: 'S', uvIndexMax: 6.2, uvLevel: 'HIGH', sunrise: '5:42 AM', sunset: '6:02 PM' },
  { day: 'WED', high: '32°', low: '26°', rainProbability: '38%', iconType: 'cloud', condition: 'Partly Cloudy', fullDate: 'Wednesday, 24 Sep 2025', precipitationSum: '1.1 mm', rainSum: '1.1 mm', snowfallSum: '0.0 cm', windSpeedMax: '18 km/h', windDirectionDominant: 'SE', uvIndexMax: 7.8, uvLevel: 'VERY HIGH', sunrise: '5:43 AM', sunset: '6:01 PM' },
  { day: 'THU', high: '30°', low: '24°', rainProbability: '72%', iconType: 'storm', condition: 'Thunderstorms Likely', fullDate: 'Thursday, 25 Sep 2025', precipitationSum: '14.5 mm', rainSum: '14.5 mm', snowfallSum: '0.0 cm', windSpeedMax: '28 km/h', windDirectionDominant: 'SW', uvIndexMax: 4.8, uvLevel: 'MODERATE', sunrise: '5:43 AM', sunset: '6:00 PM' },
  { day: 'FRI', high: '32°', low: '25°', rainProbability: '22%', iconType: 'sun', condition: 'Sunny Intervals', fullDate: 'Friday, 26 Sep 2025', precipitationSum: '0.2 mm', rainSum: '0.2 mm', snowfallSum: '0.0 cm', windSpeedMax: '15 km/h', windDirectionDominant: 'S', uvIndexMax: 8.1, uvLevel: 'VERY HIGH', sunrise: '5:44 AM', sunset: '5:59 PM' },
  { day: 'SAT', high: '31°', low: '25°', rainProbability: '40%', iconType: 'cloud', condition: 'Scattered Clouds', fullDate: 'Saturday, 27 Sep 2025', precipitationSum: '1.5 mm', rainSum: '1.5 mm', snowfallSum: '0.0 cm', windSpeedMax: '17 km/h', windDirectionDominant: 'SE', uvIndexMax: 7.0, uvLevel: 'HIGH', sunrise: '5:44 AM', sunset: '5:58 PM' },
  { day: 'SUN', high: '33°', low: '26°', rainProbability: '18%', iconType: 'sun', condition: 'Clear & Bright', fullDate: 'Sunday, 28 Sep 2025', precipitationSum: '0.0 mm', rainSum: '0.0 mm', snowfallSum: '0.0 cm', windSpeedMax: '14 km/h', windDirectionDominant: 'E', uvIndexMax: 8.6, uvLevel: 'VERY HIGH', sunrise: '5:45 AM', sunset: '5:57 PM' },
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
