import { Thermometer, Droplets, Wind, Eye, Gauge } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { Metric } from '@/components/Metric'
import type { CurrentConditions } from '@/lib/types'
import {
  classifyFeelsLike,
  classifyHumidity,
  classifyVisibility,
  classifyPressure,
} from '@/lib/weather-utils'

interface HighlightsGridProps {
  conditions: CurrentConditions
}

export function HighlightsGrid({ conditions }: HighlightsGridProps) {
  return (
    <Panel className="highlights-section wide-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AT A GLANCE</p>
          <h2>Today&apos;s highlights</h2>
        </div>
      </div>
      <div className="metrics-grid">
        <Metric
          icon={<Thermometer size={15} />}
          label="HIGH / LOW"
          value={`${conditions.high}° / ${conditions.low}°`}
          meta="Daily range"
        />
        <Metric
          icon={<Thermometer size={15} />}
          label="FEELS LIKE"
          value={`${conditions.feelsLike}°`}
          meta={classifyFeelsLike(conditions.feelsLike, conditions.temperature)}
        />
        <Metric
          icon={<Droplets size={15} />}
          label="HUMIDITY"
          value={`${conditions.humidity}%`}
          meta={classifyHumidity(conditions.humidity)}
        />
        <Metric
          icon={<Wind size={15} />}
          label="WIND"
          value={`${conditions.wind.speed} km/h`}
          meta={conditions.wind.direction}
        />
        <Metric
          icon={<Eye size={15} />}
          label="VISIBILITY"
          value={`${conditions.visibility} km`}
          meta={classifyVisibility(conditions.visibility)}
        />
        <Metric
          icon={<Gauge size={15} />}
          label="PRESSURE"
          value={`${conditions.pressure} hPa`}
          meta={classifyPressure(conditions.pressure)}
        />
      </div>
    </Panel>
  )
}
