'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  TrendingUp,
  Clock,
  Calendar,
  Thermometer,
  CloudRain,
  Wind,
  Sun,
  Droplets,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import type {
  TrendMode,
  TrendRange,
  TrendMetric24h,
  TrendMetricDaily,
  WeatherTrendsData,
} from '@/lib/trends/types'
import type { TemperatureUnit } from '@/lib/types'
import { TrendChart24h } from './TrendChart24h'
import { TrendChartDaily } from './TrendChartDaily'
import { TodayVsRecentCard } from './TodayVsRecentCard'

interface WeatherTrendsProps {
  latitude: number
  longitude: number
  cityName: string
  timezone?: string
  unit: TemperatureUnit
  className?: string
}

export function WeatherTrends({
  latitude,
  longitude,
  cityName,
  timezone = 'auto',
  unit,
  className = '',
}: WeatherTrendsProps) {
  const [mode, setMode] = useState<TrendMode>('24h')
  const [range, setRange] = useState<TrendRange>('7d')
  const [metric24h, setMetric24h] = useState<TrendMetric24h>('temp')
  const [metricDaily, setMetricDaily] = useState<TrendMetricDaily>('temp')

  const [trendsData, setTrendsData] = useState<WeatherTrendsData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const activeFetchIdRef = useRef<number>(0)

  // Fetch weather trends with cancellation on location/range change
  const fetchTrends = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const fetchId = ++activeFetchIdRef.current

    setLoading(true)
    setError(null)

    try {
      const url = `/api/weather-history?latitude=${latitude}&longitude=${longitude}&timezone=${encodeURIComponent(timezone)}&range=${range}`
      const res = await fetch(url, { signal: controller.signal })

      if (!res.ok) {
        throw new Error(`History service returned HTTP ${res.status}`)
      }

      const data: WeatherTrendsData = await res.json()

      // Guard against stale asynchronous responses
      if (fetchId === activeFetchIdRef.current) {
        setTrendsData(data)
        setLoading(false)
        setError(null)
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      if (fetchId === activeFetchIdRef.current) {
        setLoading(false)
        setError('Trend data unavailable right now.')
      }
    }
  }, [latitude, longitude, timezone, range])

  useEffect(() => {
    fetchTrends()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fetchTrends])

  // Summary badge styling
  const getSummaryToneClass = (tone?: string) => {
    switch (tone) {
      case 'warm':
        return 'tone-warm'
      case 'cool':
        return 'tone-cool'
      case 'wet':
        return 'tone-wet'
      case 'windy':
        return 'tone-windy'
      default:
        return 'tone-stable'
    }
  }

  return (
    <section
      id="weather-trends-section"
      className={`wide-section panel trends-section ${className}`}
      aria-label="Weather trends and historical comparison"
    >
      {/* SECTION HEADER */}
      <div className="section-heading trends-heading">
        <div>
          <span className="eyebrow">ANALYTICS / 05</span>
          <h2>WEATHER TRENDS</h2>
          <p className="trends-subheading">
            {cityName.toUpperCase()} • HISTORICAL BENCHMARK & MULTI-DAY TRAJECTORY
          </p>
        </div>

        {/* PRIMARY MODE SWITCHER: 24H vs MULTI-DAY */}
        <div className="trend-mode-toggle" role="tablist" aria-label="Select trend view">
          <button
            type="button"
            role="tab"
            aria-selected={mode === '24h'}
            className={`trend-tab-btn ${mode === '24h' ? 'active' : ''}`}
            onClick={() => setMode('24h')}
          >
            <Clock size={14} />
            <span>24H TREND</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'multi-day'}
            className={`trend-tab-btn ${mode === 'multi-day' ? 'active' : ''}`}
            onClick={() => setMode('multi-day')}
          >
            <Calendar size={14} />
            <span>{range.toUpperCase()} TREND</span>
          </button>
        </div>
      </div>

      {/* CONTROLS BAR: METRIC CHIPS & RANGE SELECTOR */}
      <div className="trends-controls-bar">
        {/* Metric selection buttons */}
        <div className="trend-metric-group" role="group" aria-label="Select trend metric">
          {mode === '24h' ? (
            <>
              <button
                type="button"
                className={`trend-metric-chip ${metric24h === 'temp' ? 'active' : ''}`}
                onClick={() => setMetric24h('temp')}
              >
                <Thermometer size={13} />
                <span>TEMP ({unit})</span>
              </button>
              <button
                type="button"
                className={`trend-metric-chip ${metric24h === 'feelsLike' ? 'active' : ''}`}
                onClick={() => setMetric24h('feelsLike')}
              >
                <Thermometer size={13} />
                <span>FEELS LIKE ({unit})</span>
              </button>
              <button
                type="button"
                className={`trend-metric-chip ${metric24h === 'humidity' ? 'active' : ''}`}
                onClick={() => setMetric24h('humidity')}
              >
                <Droplets size={13} />
                <span>HUMIDITY (%)</span>
              </button>
              <button
                type="button"
                className={`trend-metric-chip ${metric24h === 'wind' ? 'active' : ''}`}
                onClick={() => setMetric24h('wind')}
              >
                <Wind size={13} />
                <span>WIND (KM/H)</span>
              </button>
              <button
                type="button"
                className={`trend-metric-chip ${metric24h === 'precip' ? 'active' : ''}`}
                onClick={() => setMetric24h('precip')}
              >
                <CloudRain size={13} />
                <span>PRECIP (MM)</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`trend-metric-chip ${metricDaily === 'temp' ? 'active' : ''}`}
                onClick={() => setMetricDaily('temp')}
              >
                <Thermometer size={13} />
                <span>HIGH / LOW ({unit})</span>
              </button>
              <button
                type="button"
                className={`trend-metric-chip ${metricDaily === 'rain' ? 'active' : ''}`}
                onClick={() => setMetricDaily('rain')}
              >
                <CloudRain size={13} />
                <span>RAIN (MM)</span>
              </button>
              <button
                type="button"
                className={`trend-metric-chip ${metricDaily === 'wind' ? 'active' : ''}`}
                onClick={() => setMetricDaily('wind')}
              >
                <Wind size={13} />
                <span>PEAK WIND</span>
              </button>
              <button
                type="button"
                className={`trend-metric-chip ${metricDaily === 'uv' ? 'active' : ''}`}
                onClick={() => setMetricDaily('uv')}
              >
                <Sun size={13} />
                <span>MAX UV</span>
              </button>
            </>
          )}
        </div>

        {/* Historical Range Selector (7d, 14d, 30d) - for multi-day mode */}
        {mode === 'multi-day' && (
          <div className="trend-range-selector" role="group" aria-label="Select comparison period">
            <button
              type="button"
              className={`range-pill ${range === '7d' ? 'active' : ''}`}
              onClick={() => setRange('7d')}
            >
              7 DAYS
            </button>
            <button
              type="button"
              className={`range-pill ${range === '14d' ? 'active' : ''}`}
              onClick={() => setRange('14d')}
            >
              14 DAYS
            </button>
            <button
              type="button"
              className={`range-pill ${range === '30d' ? 'active' : ''}`}
              onClick={() => setRange('30d')}
            >
              30 DAYS
            </button>
          </div>
        )}
      </div>

      {/* ERROR STATE */}
      {error && !loading && (
        <div className="trend-error-card" role="alert">
          <div className="trend-error-content">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={fetchTrends} className="trend-retry-btn">
            <RotateCcw size={13} />
            <span>RETRY</span>
          </button>
        </div>
      )}

      {/* LOADING SKELETON */}
      {loading && (
        <div className="trend-skeleton-wrapper" aria-busy="true">
          <div className="trend-skeleton-bar pulse" />
          <div className="trend-skeleton-chart pulse" />
        </div>
      )}

      {/* MAIN CONTENT WHEN LOADED */}
      {!loading && !error && trendsData && (
        <div className="trends-content-grid">
          {/* SMART TREND SUMMARY STRIP */}
          <div className={`trend-summary-box ${getSummaryToneClass(trendsData.summary?.tone)}`}>
            <div className="trend-summary-badge">
              <Sparkles size={13} />
              <span>DETERMINISTIC TREND INSIGHT</span>
            </div>
            <strong className="trend-summary-headline">
              {trendsData.summary.headline}
            </strong>
            <p className="trend-summary-detail">{trendsData.summary.detail}</p>
          </div>

          {/* TODAY VS RECENT BENCHMARK CARD */}
          <TodayVsRecentCard comparison={trendsData.comparison} unit={unit} />

          {/* VISUAL CHART AREA */}
          <div className="trend-chart-card">
            <div className="trend-chart-header">
              <div className="trend-chart-label-block">
                <span className="trend-sub-kicker">
                  {mode === '24h'
                    ? 'HOURLY ANALYSIS • PREVIOUS 24 HOURS'
                    : `DAILY RECORDS • RECENT ${range.toUpperCase()} WINDOW`}
                </span>
                <h4 className="trend-chart-title">
                  {mode === '24h'
                    ? `${metric24h.toUpperCase()} TRAJECTORY`
                    : `${metricDaily.toUpperCase()} DISTRIBUTION`}
                </h4>
              </div>
              <div className="trend-legend">
                <span className="legend-chip past">
                  <span className="legend-dot" /> PAST OBSERVATIONS
                </span>
                <span className="legend-chip current">
                  <span className="legend-dot current" /> TODAY / CURRENT
                </span>
              </div>
            </div>

            {mode === '24h' ? (
              <TrendChart24h
                points={trendsData.hourly24h}
                metric={metric24h}
                unit={unit}
              />
            ) : (
              <TrendChartDaily
                points={trendsData.daily}
                metric={metricDaily}
                unit={unit}
              />
            )}
          </div>

          {/* ATTRIBUTION & METHODOLOGY FOOTER */}
          <div className="trend-footer-note">
            <span>
              HISTORICAL WEATHER DATA SOURCE: OPEN-METEO ARCHIVE & MODEL ANALYSIS • DETERMINISTIC DELTAS • ₹0 RECURRING COST
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
