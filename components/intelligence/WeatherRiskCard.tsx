'use client'

import React from 'react'
import { AlertTriangle, ShieldCheck, Zap, Activity } from 'lucide-react'
import type { WeatherRiskData, RiskLevel } from '@/lib/intelligence/types'

interface WeatherRiskCardProps {
  data: WeatherRiskData
}

export function WeatherRiskCard({ data }: WeatherRiskCardProps) {
  const { score, level, drivers, summary, hasOfficialAlert, highestAlertSeverity, officialAlertTitle } = data

  const getRiskColor = (lvl: RiskLevel) => {
    switch (lvl) {
      case 'VERY HIGH':
        return 'var(--coral)'
      case 'HIGH':
        return 'var(--orange)'
      case 'MODERATE':
        return 'var(--acid)'
      case 'LOW':
        return 'var(--cyan)'
      case 'VERY LOW':
      default:
        return 'var(--mint)'
    }
  }

  const getImdBadgeColor = (sev?: string) => {
    switch (sev) {
      case 'red':
        return { bg: '#ff5a52', text: '#fff' }
      case 'orange':
        return { bg: '#ff9278', text: '#111' }
      case 'yellow':
        return { bg: '#fff09a', text: '#111' }
      default:
        return { bg: 'var(--mint)', text: '#111' }
    }
  }

  const riskBg = getRiskColor(level)
  const imdStyle = getImdBadgeColor(highestAlertSeverity)

  return (
    <div className="intel-card risk-score-card">
      <div className="intel-card-header">
        <div className="intel-kicker-group">
          <span className="intel-kicker">SITUATIONAL INDEX</span>
          <h3 className="intel-title">WEATHER RISK</h3>
        </div>
        <div
          className="risk-level-tag"
          style={{ backgroundColor: riskBg }}
          aria-label={`Risk Level: ${level}`}
        >
          <Activity size={14} />
          <span>{level}</span>
        </div>
      </div>

      <div className="risk-score-main">
        <div className="risk-number-wrap">
          <span className="risk-score-val">{score}</span>
          <span className="risk-score-max">/ 100</span>
        </div>

        <div className="risk-drivers-wrap">
          <span className="risk-drivers-label">PRIMARY DRIVERS:</span>
          <div className="risk-driver-chips">
            {drivers.map((driver, idx) => (
              <span key={`driver-${idx}`} className="risk-driver-chip">
                {driver}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Clear Distinction: Official IMD Alert vs Proprietary Score */}
      {hasOfficialAlert && highestAlertSeverity && (
        <div className="imd-alert-separation-bar">
          <div className="imd-alert-pill" style={{ background: imdStyle.bg, color: imdStyle.text }}>
            <AlertTriangle size={13} />
            <span>OFFICIAL IMD: {highestAlertSeverity.toUpperCase()} ALERT</span>
          </div>
          <p className="imd-alert-note">
            {officialAlertTitle ? `Active warning: ${officialAlertTitle}. ` : ''}
            Official severity remains unchanged and separate from our composite risk index.
          </p>
        </div>
      )}

      <p className="risk-summary-text">{summary}</p>

      <div className="risk-footer">
        <ShieldCheck size={13} />
        <span>DETERMINISTIC SITUATIONAL ASSESSMENT • REAL-TIME DATA</span>
      </div>
    </div>
  )
}
