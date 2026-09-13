import { Panel } from '@/components/Panel'
import { WeatherIcon } from '@/components/WeatherIcon'
import type { HourlyEntry } from '@/lib/types'

interface HourlyForecastProps {
  entries: HourlyEntry[]
  onSelectHour?: (index: number) => void
}

export function HourlyForecast({ entries, onSelectHour }: HourlyForecastProps) {
  return (
    <Panel className="hourly-section wide-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">NEXT 12 HOURS</p>
          <h2>Hourly forecast</h2>
        </div>
        <span className="section-meta">PRECIPITATION PROBABILITY</span>
      </div>
      <div className="hourly-row">
        {entries.map((entry, i) => (
          <div
            className={`hour ${i === 0 ? 'active' : ''} interactive-forecast-card`}
            key={`hour-${entry.time}-${i}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectHour?.(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectHour?.(i)
              }
            }}
            aria-label={`View detailed weather for ${entry.time}, ${entry.condition || 'temperature'} ${entry.temperature}, rain chance ${entry.rainProbability}`}
          >
            <span>{entry.time}</span>
            <WeatherIcon type={entry.iconType} size={i === 0 ? 31 : 26} />
            <b>{entry.temperature}</b>
            <small>{entry.rainProbability}</small>
          </div>
        ))}
      </div>
    </Panel>
  )
}
