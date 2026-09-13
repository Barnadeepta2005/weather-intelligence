'use client'

import React from 'react'
import {
  CANONICAL_CLOUD_PATH,
  CANONICAL_SUN,
  CANONICAL_LIGHTNING_PATH,
  CANONICAL_COLORS,
} from '@/lib/weather-icons/canonical-paths'

export interface AtmosWeatherMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  type?: 'brand' | 'sun' | 'storm' | 'rain' | 'cloud'
  sunFill?: string
  cloudFill?: string
  strokeColor?: string
  strokeWidth?: number
}

export function AtmosWeatherMark({
  size = 42,
  type = 'brand',
  sunFill = CANONICAL_COLORS.acid,
  cloudFill = CANONICAL_COLORS.surface,
  strokeColor = CANONICAL_COLORS.ink,
  strokeWidth = 5,
  className = '',
  style,
  ...rest
}: AtmosWeatherMarkProps) {
  const isSun = type === 'sun'
  const isStorm = type === 'storm'
  const isRain = type === 'rain'
  const isBrand = type === 'brand' || type === 'cloud'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`atmos-weather-mark ${className}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      role="img"
      aria-label="ATMOS WEATHER mark"
      {...rest}
    >
      {/* 1. SUN RAYS & DISC (for Brand or Sun) */}
      {isBrand && (
        <g className="atmos-sun-peeking">
          {/* Peeking rays */}
          {CANONICAL_SUN.peeking.rays.map((ray, i) => (
            <line
              key={i}
              x1={ray.x1}
              y1={ray.y1}
              x2={ray.x2}
              y2={ray.y2}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          ))}
          {/* Peeking disc */}
          <circle
            cx={CANONICAL_SUN.peeking.cx}
            cy={CANONICAL_SUN.peeking.cy}
            r={CANONICAL_SUN.peeking.r}
            fill={sunFill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </g>
      )}

      {isSun && (
        <g className="atmos-sun-full">
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * Math.PI) / 4
            const x1 = 50 + Math.cos(angle) * CANONICAL_SUN.full.rayRadiusInner
            const y1 = 50 + Math.sin(angle) * CANONICAL_SUN.full.rayRadiusInner
            const x2 = 50 + Math.cos(angle) * CANONICAL_SUN.full.rayRadiusOuter
            const y2 = 50 + Math.sin(angle) * CANONICAL_SUN.full.rayRadiusOuter
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
            )
          })}
          <circle
            cx={50}
            cy={50}
            r={CANONICAL_SUN.full.r}
            fill={sunFill}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        </g>
      )}

      {/* 2. CANONICAL CLOUD SILHOUETTE (Single closed path, zero crossing lines) */}
      {!isSun && (
        <path
          d={CANONICAL_CLOUD_PATH}
          fill={cloudFill}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* 3. LIGHTNING BOLT (for Storm) */}
      {isStorm && (
        <path
          d={CANONICAL_LIGHTNING_PATH}
          fill={sunFill}
          stroke={strokeColor}
          strokeWidth={strokeWidth - 1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* 4. RAIN STREAKS (for Rain) */}
      {isRain && (
        <g className="atmos-rain-streaks">
          <line x1={36} y1={78} x2={30} y2={90} stroke={strokeColor} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" />
          <line x1={48} y1={78} x2={42} y2={90} stroke={strokeColor} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" />
          <line x1={60} y1={78} x2={54} y2={90} stroke={strokeColor} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" />
          <line x1={72} y1={78} x2={66} y2={90} stroke={strokeColor} strokeWidth={strokeWidth - 0.5} strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}
