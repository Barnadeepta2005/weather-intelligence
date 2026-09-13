'use client'

import React, { useState, useMemo, useRef, useCallback } from 'react'
import type { HistoricalDailyPoint, TrendMetricDaily } from '@/lib/trends/types'
import type { TemperatureUnit } from '@/lib/types'
import { celsiusToFahrenheit } from '@/lib/weather-utils'

interface TrendChartDailyProps {
  points: HistoricalDailyPoint[]
  metric: TrendMetricDaily
  unit: TemperatureUnit
}

export function TrendChartDaily({ points, metric, unit }: TrendChartDailyProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const width = 800
  const height = 260
  const padLeft = 45
  const padRight = 30
  const padTop = 32
  const padBottom = 42

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  // Process data values according to active metric and temperature unit
  const dataSeries = useMemo(() => {
    return points.map((p) => {
      let high = 0
      let low = 0
      let singleVal = 0
      let unitLabel = ''

      if (metric === 'temp') {
        high = unit === '°F' ? celsiusToFahrenheit(p.tempMax) : p.tempMax
        low = unit === '°F' ? celsiusToFahrenheit(p.tempMin) : p.tempMin
        unitLabel = unit
      } else if (metric === 'rain') {
        singleVal = p.precipitationSum
        unitLabel = 'mm'
      } else if (metric === 'wind') {
        singleVal = p.windSpeedMax
        unitLabel = 'km/h'
      } else if (metric === 'uv') {
        singleVal = p.uvIndexMax
        unitLabel = 'UV'
      }

      return {
        ...p,
        high: Number(high.toFixed(1)),
        low: Number(low.toFixed(1)),
        singleVal: Number(singleVal.toFixed(1)),
        unitLabel,
      }
    })
  }, [points, metric, unit])

  // Compute Y-axis bounds
  const { minY, maxY, effectiveSpan } = useMemo(() => {
    if (metric === 'temp') {
      const allLows = dataSeries.map((d) => d.low)
      const allHighs = dataSeries.map((d) => d.high)
      const rawMin = Math.min(...(allLows.length ? allLows : [0]))
      const rawMax = Math.max(...(allHighs.length ? allHighs : [30]))
      const span = Math.max(1, rawMax - rawMin)
      const min = Math.floor(rawMin - span * 0.1)
      const max = Math.ceil(rawMax + span * 0.1)
      return { minY: min, maxY: max, effectiveSpan: Math.max(1, max - min) }
    } else {
      const vals = dataSeries.map((d) => d.singleVal)
      const maxVal = Math.max(...(vals.length ? vals : [10]))
      const max = Math.ceil(maxVal * 1.15) || 10
      return { minY: 0, maxY: max, effectiveSpan: max }
    }
  }, [dataSeries, metric])

  const total = dataSeries.length
  const colWidth = total > 0 ? chartW / total : 40
  const barWidth = Math.min(36, Math.max(12, colWidth * 0.55))

  // Pointer interaction
  const handlePointer = useCallback(
    (clientX: number) => {
      if (!svgRef.current || total === 0) return
      const rect = svgRef.current.getBoundingClientRect()
      const relX = ((clientX - rect.left) / rect.width) * width

      let closestIdx = 0
      let minDist = Infinity
      dataSeries.forEach((_, i) => {
        const itemCenter = padLeft + (i + 0.5) * colWidth
        const dist = Math.abs(itemCenter - relX)
        if (dist < minDist) {
          minDist = dist
          closestIdx = i
        }
      })
      setHoverIndex(closestIdx)
    },
    [dataSeries, colWidth, padLeft, width, total]
  )

  const activeItem = hoverIndex !== null ? dataSeries[hoverIndex] : null

  // Metric styling
  const barFillColor = useMemo(() => {
    switch (metric) {
      case 'rain':
        return 'var(--cyan)'
      case 'wind':
        return 'var(--lavender)'
      case 'uv':
        return 'var(--orange)'
      default:
        return 'var(--blue)'
    }
  }, [metric])

  return (
    <div className="trend-chart-wrapper trend-chart-daily" aria-label="Multi-day historical weather trend chart">
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
          aria-label={`Historical ${metric} chart`}
        >
          {/* Background grid lines */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = padTop + chartH * ratio
            const val = (maxY - ratio * effectiveSpan).toFixed(0)
            return (
              <g key={`grid-daily-${idx}`}>
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
                  {val}
                </text>
              </g>
            )
          })}

          {/* Render Daily Items */}
          {dataSeries.map((d, i) => {
            const xCenter = padLeft + (i + 0.5) * colWidth
            const xLeft = xCenter - barWidth / 2
            const isHovered = hoverIndex === i

            // A. Temperature Range Bar (High/Low Range)
            if (metric === 'temp') {
              const yHigh = padTop + chartH - ((d.high - minY) / effectiveSpan) * chartH
              const yLow = padTop + chartH - ((d.low - minY) / effectiveSpan) * chartH
              const rangeHeight = Math.max(8, yLow - yHigh)

              return (
                <g key={`daily-col-${i}`}>
                  {/* Hover background column */}
                  {isHovered && (
                    <rect
                      x={padLeft + i * colWidth}
                      y={padTop}
                      width={colWidth}
                      height={chartH}
                      fill="rgba(201, 255, 74, 0.18)"
                    />
                  )}

                  {/* Range Bar with hard shadow */}
                  <rect
                    x={xLeft + 2.5}
                    y={yHigh + 2.5}
                    width={barWidth}
                    height={rangeHeight}
                    fill="var(--ink)"
                    opacity="0.3"
                  />
                  <rect
                    x={xLeft}
                    y={yHigh}
                    width={barWidth}
                    height={rangeHeight}
                    fill={d.isToday ? 'var(--acid)' : 'var(--blue)'}
                    stroke="var(--ink)"
                    strokeWidth="2"
                  />

                  {/* High Value Text */}
                  <text
                    x={xCenter}
                    y={yHigh - 7}
                    textAnchor="middle"
                    fontSize={total > 15 ? '7.5' : '9'}
                    fontWeight="900"
                    fill="var(--ink)"
                  >
                    {d.high}°
                  </text>

                  {/* Low Value Text */}
                  <text
                    x={xCenter}
                    y={yLow + 14}
                    textAnchor="middle"
                    fontSize={total > 15 ? '7.5' : '9'}
                    fontWeight="700"
                    fill="var(--muted)"
                  >
                    {d.low}°
                  </text>

                  {/* Today indicator mark */}
                  {d.isToday && (
                    <circle cx={xCenter} cy={padTop + chartH + 10} r="3" fill="var(--ink)" />
                  )}

                  {/* X Axis Date Label */}
                  <text
                    x={xCenter}
                    y={padTop + chartH + 26}
                    textAnchor="middle"
                    fontSize={total > 15 ? '7.5' : '9'}
                    fontWeight="900"
                    fill={d.isToday ? 'var(--ink)' : 'var(--muted)'}
                    letterSpacing="0.04em"
                  >
                    {d.isToday ? 'TODAY' : d.dayLabel}
                  </text>
                </g>
              )
            }

            // B. Single Metric Bar (Rain / Wind / UV)
            const barHeight = Math.max(2, ((d.singleVal - minY) / effectiveSpan) * chartH)
            const yTop = padTop + chartH - barHeight

            return (
              <g key={`daily-col-${i}`}>
                {isHovered && (
                  <rect
                    x={padLeft + i * colWidth}
                    y={padTop}
                    width={colWidth}
                    height={chartH}
                    fill="rgba(201, 255, 74, 0.18)"
                  />
                )}

                {/* Hard offset shadow */}
                {barHeight > 3 && (
                  <rect
                    x={xLeft + 2.5}
                    y={yTop + 2.5}
                    width={barWidth}
                    height={barHeight}
                    fill="var(--ink)"
                    opacity="0.3"
                  />
                )}

                {/* Bar */}
                <rect
                  x={xLeft}
                  y={yTop}
                  width={barWidth}
                  height={barHeight}
                  fill={d.isToday ? 'var(--acid)' : barFillColor}
                  stroke="var(--ink)"
                  strokeWidth="2"
                />

                {/* Value on top of bar (if total <= 14) */}
                {total <= 14 && d.singleVal > 0 && (
                  <text
                    x={xCenter}
                    y={yTop - 6}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="900"
                    fill="var(--ink)"
                  >
                    {d.singleVal}
                  </text>
                )}

                {/* Date label */}
                <text
                  x={xCenter}
                  y={padTop + chartH + 24}
                  textAnchor="middle"
                  fontSize={total > 15 ? '7.5' : '9'}
                  fontWeight="900"
                  fill={d.isToday ? 'var(--ink)' : 'var(--muted)'}
                  letterSpacing="0.04em"
                >
                  {d.isToday ? 'TODAY' : d.dayLabel}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Hover / Touch Tooltip Callout */}
        {activeItem && hoverIndex !== null && (
          <div
            className="trend-tooltip"
            style={{
              left: `${((padLeft + (hoverIndex + 0.5) * colWidth) / width) * 100}%`,
            }}
          >
            <div className="trend-tooltip-badge">
              {activeItem.isToday ? 'TODAY • ' : ''}{activeItem.dayLabel}
            </div>
            {metric === 'temp' ? (
              <strong className="trend-tooltip-val">
                High: {activeItem.high}° • Low: {activeItem.low}°
              </strong>
            ) : (
              <strong className="trend-tooltip-val">
                {activeItem.singleVal} {activeItem.unitLabel}
              </strong>
            )}
          </div>
        )}
      </div>

      {/* Accessible Table for Screen Readers */}
      <div className="sr-only">
        <table>
          <caption>Historical {metric} by day</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">{metric === 'temp' ? 'High / Low' : metric}</th>
            </tr>
          </thead>
          <tbody>
            {dataSeries.map((d, i) => (
              <tr key={`sr-daily-${i}`}>
                <td>{d.dayLabel} {d.isToday ? '(Today)' : ''}</td>
                <td>{metric === 'temp' ? `${d.high}° / ${d.low}°` : `${d.singleVal} ${d.unitLabel}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
