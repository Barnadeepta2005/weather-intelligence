'use client'

import React from 'react'
import { CloudRain, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import type { RainTimingData } from '@/lib/intelligence/types'

interface RainTimingCardProps {
  data: RainTimingData
}

export function RainTimingCard({ data }: RainTimingCardProps) {
  const { status, headline, details, peakProbability, peakTimeLabel, easingTimeLabel, intensityLabel } = data

  const getStatusBadge = () => {
    switch (status) {
      case 'RAIN_ONGOING':
        return { label: 'RAIN ONGOING', bg: 'var(--coral)', icon: <AlertCircle size={13} /> }
      case 'RAIN_UPCOMING':
        return { label: 'RAIN EXPECTED', bg: 'var(--orange)', icon: <CloudRain size={13} /> }
      case 'RAIN_POSSIBLE':
        return { label: 'LOW CHANCE', bg: 'var(--cyan)', icon: <CloudRain size={13} /> }
      case 'NO_RAIN':
      default:
        return { label: 'DRY CONDITIONS', bg: 'var(--mint)', icon: <CheckCircle2 size={13} /> }
    }
  }

  const badge = getStatusBadge()

  return (
    <div className="intel-card rain-timing-card">
      <div className="intel-card-header">
        <div className="intel-kicker-group">
          <span className="intel-kicker">PRECIPITATION RADAR & MODEL</span>
          <h3 className="intel-title">RAIN TIMING</h3>
        </div>
        <div className="intel-status-pill" style={{ backgroundColor: badge.bg }}>
          {badge.icon}
          <span>{badge.label}</span>
        </div>
      </div>

      <div className="rain-timing-body">
        <h4 className="rain-timing-headline">{headline}</h4>
        <p className="rain-timing-details">{details}</p>

        <div className="rain-timing-metrics">
          <div className="rain-metric-box">
            <span className="rain-metric-label">PEAK CHANCE</span>
            <strong className="rain-metric-val">{peakProbability}%</strong>
          </div>

          {peakTimeLabel && (
            <div className="rain-metric-box">
              <span className="rain-metric-label">WINDOW</span>
              <strong className="rain-metric-val">{peakTimeLabel}</strong>
            </div>
          )}

          {intensityLabel && (
            <div className="rain-metric-box">
              <span className="rain-metric-label">INTENSITY</span>
              <strong className="rain-metric-val">{intensityLabel}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
