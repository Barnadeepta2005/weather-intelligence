import { Sunrise, Sunset } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { WeatherIcon } from '@/components/WeatherIcon'
import type { CurrentConditions } from '@/lib/types'

interface HeroCardProps {
  conditions: CurrentConditions
}

export function HeroCard({ conditions }: HeroCardProps) {
  return (
    <Panel className="hero-card">
      <div className="panel-kicker">
        <span>LOCAL CONDITIONS</span>
        <span>{conditions.date}</span>
      </div>
      <div className="hero-main">
        <div>
          <p className="condition">{conditions.condition}</p>
          <div className="hero-temp">
            {conditions.temperature}
            <span>°</span>
          </div>
          <p className="feels">
            FEELS LIKE {conditions.feelsLike}° <b>/</b> HIGH {conditions.high}° <b>/</b> LOW {conditions.low}°
          </p>
        </div>
        <div className="hero-illustration">
          <WeatherIcon type={conditions.iconType} size={144} />
        </div>
      </div>
      <div className="hero-footer">
        <span>
          <Sunrise size={16} /> SUNRISE <b>{conditions.sunrise}</b>
        </span>
        <span>
          <Sunset size={16} /> SUNSET <b>{conditions.sunset}</b>
        </span>
        <span className="hero-note">
          {conditions.seasonNote} / {conditions.humidity}% HUMIDITY
        </span>
      </div>
    </Panel>
  )
}
