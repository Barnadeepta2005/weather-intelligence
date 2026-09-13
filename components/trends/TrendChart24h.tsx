'use client'

import React, { useState, useMemo, useRef, useCallback } from 'react'
import type { HistoricalHourlyPoint, TrendMetric24h } from '@/lib/trends/types'
import type { TemperatureUnit } from '@/lib/types'
import { celsiusToFahrenheit } from '@/lib/weather-utils'

interface TrendChart24hProps {
  points: HistoricalHourlyPoint[]
  metric: TrendMetric24h
  unit: TemperatureUnit
}

export function TrendChart24h({ points, metric, unit }: TrendChart24hProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Extract numeric values according to metric and unit
  const dataSeries = useMemo(() => {
    return points.map((p) => {
      let val = 0
      let unitLabel = ''

      if (metric === 'temp') {
        val = unit === '°F' ? celsiusToFahrenheit(p.temperature) : p.temperature
        unitLabel = unit
      } else if (metric === 'feelsLike') {
        val = unit === '°F' ? celsiusToFahrenheit(p.apparentTemperature) : p.apparentTemperature
        unitLabel = unit
      } else if (metric === 'humidity') {
        val = p.humidity
        unitLabel = '%'
      } else if (metric === 'wind') {
        val = p.windSpeed
        unitLabel = 'km/h'
      } else if (metric === 'precip') {
        val = p.precipitation
        unitLabel = 'mm'
      }

      return {
        ...p,
        val: Number(val.toFixed(1)),
        unitLabel,
      }
    })
  }, [points, metric, unit])

  // Chart dimensions & scaling
  const width = 800
  const height = 240
  const padLeft = 50
  const padRight = 30
  const padTop = 32
  const padBottom = 38

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const values = dataSeries.map((d) => d.val)
  const rawMin = Math.min(...(values.length ? values : [0]))
  const rawMax = Math.max(...(values.length ? values : [10]))

  // Pad range slightly so curve doesn't collide with borders
  const rangeSpan = Math.max(1, rawMax - rawMin)
  const minY = Math.floor(rawMin - rangeSpan * 0.1)
  const maxY = Math.ceil(rawMax + rangeSpan * 0.1)
  const effectiveSpan = Math.max(1, maxY - minY)

  // Map data to SVG coordinates
  const coords = useMemo(() => {
    const total = dataSeries.length
    if (total === 0) return []

    return dataSeries.map((d, i) => {
      const x = padLeft + (i / Math.max(1, total - 1)) * chartW
      const y = padTop + chartH - ((d.val - minY) / effectiveSpan) * chartH
      return { ...d, x, y, index: i }
    })
  }, [dataSeries, chartW, chartH, minY, effectiveSpan, padLeft, padTop])

  // Build SVG Path strings
  const linePath = useMemo(() => {
    if (coords.length === 0) return ''
    return coords.reduce((acc, pt, i) => {
      return i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`
    }, '')
  }, [coords])

  const areaPath = useMemo(() => {
    if (coords.length === 0) return ''
    const firstX = coords[0].x.toFixed(1)
    const lastX = coords[coords.length - 1].x.toFixed(1)
    const baseLineY = (padTop + chartH).toFixed(1)
    return `${linePath} L ${lastX} ${baseLineY} L ${firstX} ${baseLineY} Z`
  }, [coords, linePath, padTop, chartH])

  // Find Min and Max points for high/low callout tags
  const maxPoint = useMemo(() => {
    if (coords.length === 0) return null
    return coords.reduce((prev, curr) => (curr.val > prev.val ? curr : prev), coords[0])
  }, [coords])

  const minPoint = useMemo(() => {
    if (coords.length === 0) return null
    return coords.reduce((prev, curr) => (curr.val < prev.val ? curr : prev), coords[0])
  }, [coords])

  // Theme color based on metric
  const accentColor = useMemo(() => {
    switch (metric) {
      case 'temp':
        return 'var(--acid)'
      case 'feelsLike':
        return 'var(--orange)'
      case 'humidity':
        return 'var(--cyan)'
      case 'wind':
        return 'var(--lavender)'
      case 'precip':
        return 'var(--mint)'
      default:
        return 'var(--acid)'
    }
  }, [metric])

  // Pointer interaction
  const handlePointer = useCallback(
    (clientX: number) => {
      if (!svgRef.current || coords.length === 0) return
      const rect = svgRef.current.getBoundingClientRect()
      const relativeX = ((clientX - rect.left) / rect.width) * width

      let closestIdx = 0
      let minDist = Infinity
      coords.forEach((pt, i) => {
        const dist = Math.abs(pt.x - relativeX)
        if (dist < minDist) {
          minDist = dist
          closestIdx = i
        }
      })
      setHoverIndex(closestIdx)
    },
    [coords, width]
  )

  const activePoint = hoverIndex !== null ? coords[hoverIndex] : null

  return (
    <div className="trend-chart-wrapper trend-chart-24h" aria-label="24-hour historical weather trend line chart">
      <div className="trend-chart-container">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="trend-svg-chart"
          onMouseMove={(e) => handlePointer(e.clientX)}
          onTouchMove={(e) => {
            if (e.touches.length > 0) handlePointer(e.touches[0].clientX)
          }}
          onMouseLeave={() => setHoverIndex(null)}
          onTouchEnd={() => setHoverIndex(null)}
          role="img"
          aria-label={`24-hour ${metric} trend visualization`}
        >
          <defs>
            <linearGradient id={`areaGrad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.45" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.03" />
            </linearGradient>
            <filter id="neoShadow" x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="3" dy="3" stdDeviation="0" floodColor="#111" />
            </filter>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = padTop + chartH * ratio
            const gridVal = (maxY - ratio * effectiveSpan).toFixed(0)
            return (
              <g key={`grid-${idx}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#e2ded4"
                  strokeWidth="1.5"
                  strokeDasharray={idx === 3 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="9"
                  fontWeight="900"
                  fill="var(--muted)"
                  letterSpacing="0.05em"
                >
                  {gridVal}
                </text>
              </g>
            )
          })}

          {/* Area under curve */}
          {areaPath && <path d={areaPath} fill={`url(#areaGrad-${metric})`} />}

          {/* Thick Neo-Brutalist Stroke Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* X Axis Time Labels (every 4 hours) */}
          {coords.map((pt, i) => {
            const showLabel = i % 4 === 0 || i === coords.length - 1
            if (!showLabel) return null
            return (
              <g key={`x-label-${i}`}>
                <line x1={pt.x} y1={padTop + chartH} x2={pt.x} y2={padTop + chartH + 5} stroke="var(--ink)" strokeWidth="1.5" />
                <text
                  x={pt.x}
                  y={padTop + chartH + 18}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="900"
                  letterSpacing="0.05em"
                  fill={pt.isCurrent ? 'var(--ink)' : 'var(--muted)'}
                >
                  {pt.isCurrent ? 'NOW' : pt.hourLabel}
                </text>
              </g>
            )
          })}

          {/* Data Points */}
          {coords.map((pt, i) => {
            const isHigh = maxPoint && maxPoint.index === i
            const isLow = minPoint && minPoint.index === i
            const isHovered = hoverIndex === i

            return (
              <g key={`point-${i}`}>
                {/* Current or Hovered point ring */}
                {(pt.isCurrent || isHovered) && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={pt.isCurrent ? 7.5 : 6}
                    fill={accentColor}
                    stroke="var(--ink)"
                    strokeWidth="2.5"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={pt.isCurrent ? 3.5 : 2.5}
                  fill={pt.isCurrent ? 'var(--ink)' : 'var(--ink)'}
                />
              </g>
            )
          })}

          {/* High / Low Badge Markers */}
          {maxPoint && (
            <g transform={`translate(${maxPoint.x}, ${Math.max(16, maxPoint.y - 12)})`}>
              <rect
                x="-22"
                y="-13"
                width="48"
                height="15"
                fill="var(--ink)"
              />
              <rect
                x="-24"
                y="-15"
                width="48"
                height="15"
                fill="var(--surface)"
                stroke="var(--ink)"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="-4"
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="900"
                fill="var(--ink)"
                letterSpacing="0.04em"
              >
                H: {maxPoint.val}{maxPoint.unitLabel}
              </text>
            </g>
          )}

          {minPoint && minPoint.index !== maxPoint?.index && (
            <g transform={`translate(${minPoint.x}, ${Math.min(height - 18, minPoint.y + 22)})`}>
              <rect
                x="-22"
                y="-10"
                width="48"
                height="15"
                fill="var(--ink)"
              />
              <rect
                x="-24"
                y="-12"
                width="48"
                height="15"
                fill="var(--surface)"
                stroke="var(--ink)"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="-1"
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="900"
                fill="var(--ink)"
                letterSpacing="0.04em"
              >
                L: {minPoint.val}{minPoint.unitLabel}
              </text>
            </g>
          )}

          {/* Active Hover / Touch Crosshair */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={padTop}
                x2={activePoint.x}
                y2={padTop + chartH}
                stroke="var(--ink)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7"
                fill={accentColor}
                stroke="var(--ink)"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Active Tooltip Callout */}
        {activePoint && (
          <div
            className="trend-tooltip"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
            }}
          >
            <div className="trend-tooltip-badge">
              {activePoint.isCurrent ? 'NOW • CURRENT' : activePoint.hourLabel}
            </div>
            <strong className="trend-tooltip-val">
              {activePoint.val} {activePoint.unitLabel}
            </strong>
          </div>
        )}
      </div>

      {/* Screen Reader Accessible Data Table */}
      <div className="sr-only">
        <table>
          <caption>24-Hour {metric} Historical Data</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">{metric}</th>
            </tr>
          </thead>
          <tbody>
            {dataSeries.map((d, i) => (
              <tr key={`sr-row-${i}`}>
                <td>{d.hourLabel}</td>
                <td>{d.val} {d.unitLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
