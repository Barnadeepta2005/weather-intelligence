'use client'

import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Droplets,
  Wind,
  Sun,
  Eye,
  Gauge,
  Cloud,
  Sunrise,
  Sunset,
  Clock,
  Calendar,
  Compass,
} from 'lucide-react'
import { WeatherIcon } from '@/components/WeatherIcon'
import type { HourlyEntry, DailyEntry, TemperatureUnit } from '@/lib/types'

export type ForecastDetailItem =
  | {
      type: 'hour'
      entry: HourlyEntry
      locationName: string
      unit: TemperatureUnit
    }
  | {
      type: 'day'
      entry: DailyEntry
      locationName: string
      unit: TemperatureUnit
    }

interface ForecastDetailModalProps {
  item: ForecastDetailItem | null
  onClose: () => void
}

export function ForecastDetailModal({ item, onClose }: ForecastDetailModalProps) {
  const [mounted, setMounted] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!item) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [item])

  // Focus close button on mount
  useEffect(() => {
    if (item && closeBtnRef.current) {
      closeBtnRef.current.focus()
    }
  }, [item])

  // Close on Escape key
  useEffect(() => {
    if (!item) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [item, onClose])

  if (!item || !mounted) return null

  const isHour = item.type === 'hour'
  const hourEntry = isHour ? item.entry : null
  const dayEntry = !isHour ? item.entry : null

  const title = isHour
    ? `${hourEntry?.time} Outlook`
    : `${dayEntry?.day} Forecast`

  const subtitle = isHour
    ? hourEntry?.fullTime || hourEntry?.date || `${hourEntry?.time} • Local Time`
    : dayEntry?.fullDate || dayEntry?.date || `${dayEntry?.day} • Outlook`

  const modalContent = (
    <div
      className="forecast-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="forecast-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="forecast-modal-title"
        aria-describedby="forecast-modal-desc"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="forecast-modal-header">
          <div>
            <div className="forecast-modal-kicker">
              {isHour ? <Clock size={12} /> : <Calendar size={12} />}
              <span>
                {isHour ? 'HOURLY FORECAST / DETAIL' : '7-DAY FORECAST / DETAIL'}
              </span>
              <span className="forecast-modal-location">
                {item.locationName.toUpperCase()}
              </span>
            </div>
            <h2 id="forecast-modal-title" className="forecast-modal-title">{title}</h2>
            <p id="forecast-modal-desc" className="forecast-modal-subtitle">
              {subtitle}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="forecast-modal-close"
            onClick={onClose}
            aria-label="Close forecast detail view"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hero Summary Card */}
        <div className="forecast-modal-hero">
          <div className="forecast-hero-left">
            <span className="forecast-hero-condition">
              {(isHour ? hourEntry?.condition : dayEntry?.condition) || 'WEATHER CONDITIONS'}
            </span>
            {isHour ? (
              <div className="forecast-hero-temp">
                <strong>{hourEntry?.temperature}</strong>
                {hourEntry?.feelsLike && (
                  <span className="forecast-hero-feels">
                    FEELS LIKE {hourEntry.feelsLike}
                  </span>
                )}
              </div>
            ) : (
              <div className="forecast-hero-temp-band">
                <div className="temp-band-item high">
                  <span>HIGH</span>
                  <strong>{dayEntry?.high}</strong>
                </div>
                <div className="temp-band-item low">
                  <span>LOW</span>
                  <strong>{dayEntry?.low}</strong>
                </div>
              </div>
            )}
          </div>
          <div className="forecast-hero-right">
            <WeatherIcon
              type={isHour ? (hourEntry?.iconType || 'sun') : (dayEntry?.iconType || 'sun')}
              size={56}
            />
          </div>
        </div>

        {/* Solar Ephemeris Strip if available */}
        {((isHour && (hourEntry?.sunrise || hourEntry?.sunset)) ||
          (!isHour && (dayEntry?.sunrise || dayEntry?.sunset))) && (
          <div className="forecast-sun-strip">
            <div className="sun-item">
              <Sunrise size={14} />
              <span>SUNRISE:</span>
              <b>{(isHour ? hourEntry?.sunrise : dayEntry?.sunrise) || 'N/A'}</b>
            </div>
            <div className="sun-item">
              <Sunset size={14} />
              <span>SUNSET:</span>
              <b>{(isHour ? hourEntry?.sunset : dayEntry?.sunset) || 'N/A'}</b>
            </div>
          </div>
        )}

        {/* Structured Metrics Grid */}
        <div className="forecast-modal-grid">
          {/* Tile 1: Precipitation Probability */}
          <div className="forecast-tile">
            <div className="forecast-tile-label">
              <Droplets size={13} />
              <span>RAIN PROBABILITY</span>
            </div>
            <strong className="forecast-tile-val">
              {(isHour ? hourEntry?.rainProbability : dayEntry?.rainProbability) || '0%'}
            </strong>
            <small className="forecast-tile-hint">Chance of precipitation</small>
          </div>

          {/* Tile 2: Precipitation Amount */}
          <div className="forecast-tile">
            <div className="forecast-tile-label">
              <Droplets size={13} />
              <span>{isHour ? 'PRECIPITATION' : 'TOTAL PRECIPITATION'}</span>
            </div>
            <strong className="forecast-tile-val">
              {(isHour ? hourEntry?.precipitation : dayEntry?.precipitationSum) || '0.0 mm'}
            </strong>
            <small className="forecast-tile-hint">
              {isHour
                ? `Rain: ${hourEntry?.rain || '0.0 mm'}`
                : `Rain sum: ${dayEntry?.rainSum || '0.0 mm'}`}
            </small>
          </div>

          {/* Tile 3: Wind & Direction */}
          <div className="forecast-tile">
            <div className="forecast-tile-label">
              <Wind size={13} />
              <span>{isHour ? 'WIND SPEED & DIRECTION' : 'MAX WIND SPEED'}</span>
            </div>
            <strong className="forecast-tile-val">
              {(isHour ? hourEntry?.windSpeed : dayEntry?.windSpeedMax) || 'Calm'}
            </strong>
            <small className="forecast-tile-hint">
              {isHour
                ? `Direction: ${hourEntry?.windDirection || 'N/A'}`
                : `Prevailing: ${dayEntry?.windDirectionDominant || 'N/A'}`}
            </small>
          </div>

          {/* Tile 4: UV Radiation */}
          <div className="forecast-tile">
            <div className="forecast-tile-label">
              <Sun size={13} />
              <span>{isHour ? 'UV INDEX' : 'MAX UV INDEX'}</span>
            </div>
            <strong className="forecast-tile-val">
              {(isHour ? hourEntry?.uvIndex : dayEntry?.uvIndexMax) ?? '0'}
            </strong>
            <small className="forecast-tile-hint">
              {(isHour ? hourEntry?.uvLevel : dayEntry?.uvLevel) || 'Standard exposure'}
            </small>
          </div>

          {/* Tile 5: Humidity or Cloud Cover (Hourly has both, Daily shows snowfall if present or clouds) */}
          {isHour ? (
            <div className="forecast-tile">
              <div className="forecast-tile-label">
                <Cloud size={13} />
                <span>HUMIDITY & CLOUDS</span>
              </div>
              <strong className="forecast-tile-val">
                {hourEntry?.humidity || 'N/A'}
              </strong>
              <small className="forecast-tile-hint">
                Cloud cover: {hourEntry?.cloudCover || '0%'}
              </small>
            </div>
          ) : (
            <div className="forecast-tile">
              <div className="forecast-tile-label">
                <Compass size={13} />
                <span>SNOWFALL SUM</span>
              </div>
              <strong className="forecast-tile-val">
                {dayEntry?.snowfallSum || '0.0 cm'}
              </strong>
              <small className="forecast-tile-hint">Accumulation expected</small>
            </div>
          )}

          {/* Tile 6: Pressure & Visibility (Hourly) or Day Timing (Daily) */}
          {isHour ? (
            <div className="forecast-tile">
              <div className="forecast-tile-label">
                <Gauge size={13} />
                <span>PRESSURE & VISIBILITY</span>
              </div>
              <strong className="forecast-tile-val">
                {hourEntry?.pressure || '1013 hPa'}
              </strong>
              <small className="forecast-tile-hint">
                Visibility: {hourEntry?.visibility || '10.0 km'}
              </small>
            </div>
          ) : (
            <div className="forecast-tile">
              <div className="forecast-tile-label">
                <Eye size={13} />
                <span>OBSERVATION WINDOW</span>
              </div>
              <strong className="forecast-tile-val">24 HOURS</strong>
              <small className="forecast-tile-hint">Full calendar day outlook</small>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="forecast-modal-footer">
          <span className="forecast-footer-hint">
            Press <kbd>ESC</kbd> or click outside to dismiss
          </span>
          <button
            type="button"
            className="primary-btn forecast-done-btn"
            onClick={onClose}
          >
            DONE
          </button>
        </div>
      </section>
    </div>
  )

  return createPortal(modalContent, document.body)
}
