'use client'

import React from 'react'
import { Sun, Wind, Droplets, ShieldAlert, CheckCircle2 } from 'lucide-react'
import type { HeatUvGuidanceData, AirWeatherGuidanceData, HeatUvLevel, AirWeatherLevel } from '@/lib/intelligence/types'
import type { TemperatureUnit } from '@/lib/types'

interface HeatAirCardProps {
  heatUv: HeatUvGuidanceData
  airWeather: AirWeatherGuidanceData
  unit: TemperatureUnit
}

export function HeatAirCard({ heatUv, airWeather, unit }: HeatAirCardProps) {
  const getHeatUvColor = (lvl: HeatUvLevel) => {
    switch (lvl) {
      case 'VERY HIGH':
        return 'var(--coral)'
      case 'HIGH':
        return 'var(--orange)'
      case 'MODERATE':
        return 'var(--acid)'
      case 'LOW':
      default:
        return 'var(--mint)'
    }
  }

  const getAirColor = (lvl: AirWeatherLevel) => {
    switch (lvl) {
      case 'HAZARDOUS':
      case 'UNHEALTHY':
        return 'var(--coral)'
      case 'UNHEALTHY_SENSITIVE':
        return 'var(--orange)'
      case 'MODERATE':
        return 'var(--acid)'
      case 'GOOD':
      default:
        return 'var(--mint)'
    }
  }

  // Convert feels-like to unit
  const displayFeelsLike =
    unit === '°F'
      ? `${Math.round((heatUv.feelsLikeC * 9) / 5 + 32)}°F`
      : `${Math.round(heatUv.feelsLikeC)}°C`

  return (
    <div className="heat-air-container">
      {/* HEAT & UV GUIDANCE */}
      <div className="intel-card heat-uv-card">
        <div className="intel-card-header">
          <div className="intel-kicker-group">
            <span className="intel-kicker">SOLAR & THERMAL</span>
            <h3 className="intel-title">HEAT & UV</h3>
          </div>
          <div className="intel-status-pill" style={{ backgroundColor: getHeatUvColor(heatUv.level) }}>
            <Sun size={13} />
            <span>{heatUv.level}</span>
          </div>
        </div>

        <div className="intel-card-body">
          <strong className="intel-body-headline">{heatUv.headline}</strong>
          <p className="intel-body-details">{heatUv.details}</p>

          <div className="intel-metric-row">
            <div className="intel-metric-tag">
              <span>UV INDEX:</span>
              <strong>{heatUv.uvIndex}</strong>
            </div>
            <div className="intel-metric-tag">
              <span>FEELS LIKE:</span>
              <strong>{displayFeelsLike}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* AIR + WEATHER COMBINED GUIDANCE */}
      <div className="intel-card air-weather-card">
        <div className="intel-card-header">
          <div className="intel-kicker-group">
            <span className="intel-kicker">ENVIRONMENTAL INTERPRETATION</span>
            <h3 className="intel-title">AIR + WEATHER</h3>
          </div>
          <div className="intel-status-pill" style={{ backgroundColor: getAirColor(airWeather.level) }}>
            <Wind size={13} />
            <span>{airWeather.level.replace('_', ' ')}</span>
          </div>
        </div>

        <div className="intel-card-body">
          <strong className="intel-body-headline">{airWeather.headline}</strong>
          <p className="intel-body-details">{airWeather.details}</p>

          <div className="intel-source-banner">
            <span className="source-tag">{airWeather.sourceType.toUpperCase()}</span>
            <span className="source-aqi">AQI {airWeather.aqi}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
