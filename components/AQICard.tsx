import { Gauge } from 'lucide-react'
import { Panel } from '@/components/Panel'
import type { AirQualityData } from '@/lib/types'

interface AQICardProps {
  data: AirQualityData
}

export function AQICard({ data }: AQICardProps) {
  const isUnavailable = data.level === 'UNAVAILABLE' || data.index === null
  const isCPCB = data.standard === 'CPCB'
  const isUS = data.standard === 'US'
  const isGround = data.sourceType === 'GROUND_STATION'

  // Dynamic card title according to standard
  let standardLabel = 'US AIR QUALITY INDEX'
  if (isCPCB) {
    standardLabel = 'CPCB AIR QUALITY'
  } else if (data.standard === 'EUROPEAN') {
    standardLabel = 'EUROPEAN AQI'
  }

  // Meter scale calculation:
  // CPCB: 0–500 scale (visually map up to 350 for sensitivity)
  // US: 0–500 scale (visually map up to 300)
  // European: 0–100 scale
  const maxMeter = isCPCB ? 350 : isUS ? 300 : 100
  const meterPercent = isUnavailable || data.index === null
    ? '0%'
    : `${Math.min(100, Math.max(8, (data.index / maxMeter) * 100))}%`

  // Harmonious badge color for CPCB and US categories
  let levelBg = 'var(--orange)'
  let levelColor = 'var(--ink)'
  const lvl = (data.level || '').toUpperCase()
  if (lvl === 'GOOD') {
    levelBg = '#8ddd9a'
  } else if (lvl === 'SATISFACTORY') {
    levelBg = '#a7f3d0'
  } else if (lvl === 'MODERATE') {
    levelBg = '#fed7aa'
  } else if (lvl === 'POOR') {
    levelBg = 'var(--orange)'
  } else if (lvl === 'VERY POOR' || lvl === 'UNHEALTHY') {
    levelBg = 'var(--coral)'
  } else if (lvl === 'SEVERE' || lvl === 'HAZARDOUS') {
    levelBg = '#dc2626'
    levelColor = '#ffffff'
  } else if (lvl === 'UNAVAILABLE') {
    levelBg = '#e5e7eb'
  }

  return (
    <Panel className="air-card">
      <div className="panel-heading">
        <h2 style={{ fontSize: '11px', fontWeight: 900, margin: 0, letterSpacing: '0.1em' }}>{standardLabel}</h2>
        <Gauge size={18} aria-hidden="true" />
      </div>

      {/* Honest source-type badge (CPCB Ground Data vs Modeled Air Quality) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '10px',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '9px',
            fontWeight: 900,
            letterSpacing: '0.04em',
            padding: '2px 7px',
            border: '1.5px solid var(--ink)',
            background: isGround ? '#a7f3d0' : '#e0e7ff',
            color: 'var(--ink)',
            boxShadow: '1.5px 1.5px 0 var(--ink)',
          }}
        >
          {isGround ? 'CPCB GROUND DATA' : 'MODELED AIR QUALITY'}
        </span>

        {data.isFallback && (
          <span
            style={{
              fontSize: '8.5px',
              fontWeight: 800,
              color: '#9a3412',
              letterSpacing: '0.02em',
            }}
          >
            STATION DATA UNAVAILABLE
          </span>
        )}
      </div>

      <div className="aqi-value">
        <strong>{isUnavailable || data.index === null ? '—' : data.index}</strong>
        <span style={{ background: levelBg, color: levelColor }}>{data.level}</span>
      </div>

      <div className="meter">
        <i style={{ width: meterPercent }} />
      </div>

      <div className="aqi-scale">
        <span>GOOD</span>
        <span>{isCPCB ? 'SATISFACTORY' : 'MODERATE'}</span>
        <span>{isCPCB ? 'POOR' : isUS ? 'UNHEALTHY' : 'POOR'}</span>
      </div>

      {/* Source attribution & prominent pollutant */}
      <div
        style={{
          fontSize: '9px',
          fontWeight: 700,
          color: 'var(--muted)',
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={data.sourceName}
        >
          Source: {data.sourceName}
        </span>
        {data.prominentPollutant && (
          <span
            style={{
              fontWeight: 900,
              color: 'var(--ink)',
              background: '#fff09a',
              padding: '1px 5px',
              border: '1.5px solid var(--ink)',
              whiteSpace: 'nowrap',
              fontSize: '8.5px',
              letterSpacing: '0.03em',
            }}
          >
            PRIMARY: {data.prominentPollutant}
          </span>
        )}
      </div>

      {/* Individual monitored pollutants */}
      <div className="pollutants">
        <span>
          PM2.5 <b>{data.pm25 !== null && data.pm25 !== undefined ? `${data.pm25} µg/m³` : '—'}</b>
        </span>
        <span>
          PM10 <b>{data.pm10 !== null && data.pm10 !== undefined ? `${data.pm10} µg/m³` : '—'}</b>
        </span>
        <span>
          O₃ <b>{data.o3 !== null && data.o3 !== undefined ? `${data.o3} µg/m³` : '—'}</b>
        </span>
        <span>
          NO₂ <b>{data.no2 !== null && data.no2 !== undefined ? `${data.no2} µg/m³` : '—'}</b>
        </span>
      </div>
    </Panel>
  )
}
