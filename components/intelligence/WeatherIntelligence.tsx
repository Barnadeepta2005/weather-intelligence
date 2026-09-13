'use client'

import React from 'react'
import { Sparkles, BrainCircuit } from 'lucide-react'
import type { WeatherIntelligenceData } from '@/lib/intelligence/types'
import type { TemperatureUnit } from '@/lib/types'
import { WeatherRiskCard } from './WeatherRiskCard'
import { RainTimingCard } from './RainTimingCard'
import { OutdoorCommuteCard } from './OutdoorCommuteCard'
import { HeatAirCard } from './HeatAirCard'
import { TodayActionPlanCard } from './TodayActionPlanCard'

interface WeatherIntelligenceProps {
  data: WeatherIntelligenceData
  cityName: string
  unit: TemperatureUnit
  className?: string
}

export function WeatherIntelligence({
  data,
  cityName,
  unit,
  className = '',
}: WeatherIntelligenceProps) {
  return (
    <section
      id="weather-intelligence-section"
      className={`wide-section panel intelligence-section ${className}`}
      aria-label="Advanced weather intelligence and decision support"
    >
      {/* SECTION HEADER */}
      <div className="section-heading intelligence-heading">
        <div>
          <span className="eyebrow">DECISION SUPPORT / 04</span>
          <h2>ADVANCED WEATHER INTELLIGENCE</h2>
          <p className="intelligence-subheading">
            {cityName.toUpperCase()} • DETERMINISTIC SITUATIONAL GUIDANCE & ACTION PLAN
          </p>
        </div>
        <div className="intelligence-tag">
          <BrainCircuit size={14} />
          <span>ZERO-COST DETERMINISTIC ENGINE</span>
        </div>
      </div>

      <div className="intelligence-grid">
        {/* ROW 1: PRIMARY SITUATIONAL RISK SCORE */}
        <WeatherRiskCard data={data.risk} />

        {/* ROW 2: RAIN TIMING INTELLIGENCE */}
        <RainTimingCard data={data.rainTiming} />

        {/* ROW 3: OUTDOOR ACTIVITY & COMMUTE GUIDANCE */}
        <OutdoorCommuteCard outdoor={data.outdoor} commute={data.commute} />

        {/* ROW 4: SOLAR/THERMAL HEAT & AIR QUALITY DYNAMICS */}
        <HeatAirCard heatUv={data.heatUv} airWeather={data.airWeather} unit={unit} />

        {/* ROW 5: TODAY'S ACTION PLAN */}
        <TodayActionPlanCard items={data.actionPlan} />
      </div>

      <div className="intel-footer-note">
        <span>
          EVALUATED FROM LIVE OBSERVATIONS, IMD OFFICIAL FEEDS, AND HOURLY MODELS • NO LLM HALLUCINATIONS • DETERMINISTIC PRECISION
        </span>
      </div>
    </section>
  )
}
