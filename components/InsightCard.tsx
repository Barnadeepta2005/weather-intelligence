'use client'

import React from 'react'
import {
  Zap,
  ChevronRight,
  AlertTriangle,
  CloudRain,
  Sun,
  Wind,
  ShieldAlert,
  CheckCircle2,
  CloudSnow,
  Sparkles,
} from 'lucide-react'
import { Panel } from '@/components/Panel'
import type { InsightData } from '@/lib/types'

interface InsightCardProps {
  insight: InsightData
}

function renderCategoryIcon(categoryOrIcon?: string) {
  const key = categoryOrIcon?.toUpperCase() || ''
  switch (key) {
    case 'ALERT':
      return <AlertTriangle size={18} style={{ color: 'var(--coral)' }} />
    case 'RAIN':
      return <CloudRain size={18} style={{ color: 'var(--cyan)' }} />
    case 'HEAT':
    case 'UV':
    case 'SUN':
      return <Sun size={18} style={{ color: 'var(--orange)' }} />
    case 'WIND':
      return <Wind size={18} style={{ color: 'var(--mint)' }} />
    case 'AIR_QUALITY':
    case 'SHIELD':
      return <ShieldAlert size={18} style={{ color: 'var(--lavender)' }} />
    case 'COLD':
      return <CloudSnow size={18} style={{ color: 'var(--blue)' }} />
    case 'STABLE':
    case 'CHECK':
      return <CheckCircle2 size={18} style={{ color: 'var(--acid)' }} />
    default:
      return <Zap size={18} style={{ color: 'var(--acid)' }} />
  }
}

export function InsightCard({ insight }: InsightCardProps) {
  const headline = insight.headline || insight.heading
  const emphasis = insight.headingEmphasis
  const explanation = insight.explanation || insight.description
  const recommendation = insight.recommendation

  return (
    <Panel className="insight-card">
      <div className="panel-heading">
        <span>TODAY&apos;S INSIGHT</span>
        {renderCategoryIcon(insight.icon || insight.category)}
      </div>

      <h2>
        {headline}
        {emphasis && (
          <>
            <br />
            <em>{emphasis}</em>
          </>
        )}
      </h2>

      <p>{explanation}</p>

      {recommendation && (
        <div className="insight-recommendation">
          <div className="recommendation-badge">
            <Sparkles size={12} />
            <span>WHAT TO DO</span>
          </div>
          <p className="recommendation-text">{recommendation}</p>
        </div>
      )}

      <div className="insight-metrics">
        <div>
          <span>RAIN CHANCE</span>
          <b>{insight.rainChance || '0%'}</b>
        </div>
        <div>
          <span>WIND</span>
          <b>{insight.wind || '0 km/h'}</b>
        </div>
      </div>

      <a
        href="#forecast"
        className="primary-btn insight-forecast-btn"
        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
        onClick={(e) => {
          e.preventDefault()
          const target = document.getElementById('forecast')
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            window.history.replaceState(null, '', '#forecast')
          }
        }}
        aria-label="View 7-day full forecast outlook"
      >
        VIEW FULL FORECAST <ChevronRight size={15} />
      </a>
    </Panel>
  )
}
