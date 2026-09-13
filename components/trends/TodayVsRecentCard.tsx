'use client'

import React from 'react'
import { Thermometer, CloudRain, Wind, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { TodayComparison } from '@/lib/trends/types'
import type { TemperatureUnit } from '@/lib/types'
import { celsiusToFahrenheit } from '@/lib/weather-utils'

interface TodayVsRecentCardProps {
  comparison: TodayComparison
  unit: TemperatureUnit
}

export function TodayVsRecentCard({ comparison, unit }: TodayVsRecentCardProps) {
  const { temp, rain, wind, baselineDays } = comparison

  // Client-side unit conversion for temperature
  const formatTemp = (celsius: number) => {
    if (unit === '°F') {
      return `${celsiusToFahrenheit(celsius)}°F`
    }
    return `${celsius.toFixed(1)}°C`
  }

  // Calculate temp diff in selected unit
  const tempDiffDisplay = () => {
    if (temp.status === 'same') return 'ABOUT THE SAME'
    if (unit === '°F') {
      // In Fahrenheit, delta scale is 1.8 * Celsius delta
      const diffF = (temp.diff * 1.8).toFixed(1)
      const sign = temp.diff > 0 ? '+' : ''
      const qual = Math.abs(temp.diff) >= 3 ? (temp.diff > 0 ? 'MUCH WARMER' : 'MUCH COOLER') : (temp.diff > 0 ? 'SLIGHTLY WARMER' : 'SLIGHTLY COOLER')
      return `${sign}${diffF}°F ${qual}`
    }
    return temp.text
  }

  const getStatusIcon = (status: string) => {
    if (status === 'warmer' || status === 'wetter' || status === 'stronger') {
      return <TrendingUp size={14} />
    }
    if (status === 'cooler' || status === 'drier' || status === 'calmer') {
      return <TrendingDown size={14} />
    }
    return <Minus size={14} />
  }

  const getStatusClass = (status: string) => {
    if (status === 'warmer') return 'trend-badge-warmer'
    if (status === 'cooler') return 'trend-badge-cooler'
    if (status === 'wetter') return 'trend-badge-wetter'
    if (status === 'drier') return 'trend-badge-drier'
    if (status === 'stronger') return 'trend-badge-stronger'
    if (status === 'calmer') return 'trend-badge-calmer'
    return 'trend-badge-neutral'
  }

  return (
    <div className="today-vs-recent-card" aria-label="Today versus recent historical conditions">
      <div className="today-vs-recent-header">
        <span className="trend-kicker">HISTORICAL BENCHMARK</span>
        <h3 className="today-vs-recent-title">TODAY VS RECENT {baselineDays}-DAY AVERAGE</h3>
      </div>

      <div className="today-vs-recent-grid">
        {/* TEMPERATURE COMPARISON */}
        <div className="comparison-tile">
          <div className="comparison-tile-header">
            <span className="comparison-metric-label">
              <Thermometer size={14} />
              <span>TEMPERATURE</span>
            </span>
            <span className={`trend-delta-badge ${getStatusClass(temp.status)}`}>
              {getStatusIcon(temp.status)}
              <span>{tempDiffDisplay()}</span>
            </span>
          </div>
          <div className="comparison-values">
            <div className="comparison-val-col">
              <span className="val-caption">TODAY AVG</span>
              <strong className="val-main">{formatTemp(temp.todayValue)}</strong>
            </div>
            <div className="comparison-divider" />
            <div className="comparison-val-col">
              <span className="val-caption">{baselineDays}D NORM</span>
              <span className="val-sub">{formatTemp(temp.baselineAvg)}</span>
            </div>
          </div>
        </div>

        {/* PRECIPITATION COMPARISON */}
        <div className="comparison-tile">
          <div className="comparison-tile-header">
            <span className="comparison-metric-label">
              <CloudRain size={14} />
              <span>PRECIPITATION</span>
            </span>
            <span className={`trend-delta-badge ${getStatusClass(rain.status)}`}>
              {getStatusIcon(rain.status)}
              <span>{rain.text}</span>
            </span>
          </div>
          <div className="comparison-values">
            <div className="comparison-val-col">
              <span className="val-caption">TODAY RAIN</span>
              <strong className="val-main">{rain.todayValue.toFixed(1)} mm</strong>
            </div>
            <div className="comparison-divider" />
            <div className="comparison-val-col">
              <span className="val-caption">{baselineDays}D DAILY AVG</span>
              <span className="val-sub">{rain.baselineAvg.toFixed(1)} mm</span>
            </div>
          </div>
        </div>

        {/* WIND SPEED COMPARISON */}
        <div className="comparison-tile">
          <div className="comparison-tile-header">
            <span className="comparison-metric-label">
              <Wind size={14} />
              <span>PEAK WIND</span>
            </span>
            <span className={`trend-delta-badge ${getStatusClass(wind.status)}`}>
              {getStatusIcon(wind.status)}
              <span>{wind.text}</span>
            </span>
          </div>
          <div className="comparison-values">
            <div className="comparison-val-col">
              <span className="val-caption">TODAY MAX</span>
              <strong className="val-main">{Math.round(wind.todayValue)} km/h</strong>
            </div>
            <div className="comparison-divider" />
            <div className="comparison-val-col">
              <span className="val-caption">{baselineDays}D PEAK AVG</span>
              <span className="val-sub">{Math.round(wind.baselineAvg)} km/h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
