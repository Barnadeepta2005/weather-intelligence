import { ChevronRight } from 'lucide-react'
import { Panel } from '@/components/Panel'
import { WeatherIcon } from '@/components/WeatherIcon'
import type { DailyEntry } from '@/lib/types'

interface WeeklyForecastProps {
  entries: DailyEntry[]
  onSelectDay?: (index: number) => void
}

export function WeeklyForecast({ entries, onSelectDay }: WeeklyForecastProps) {
  return (
    <Panel id="forecast" className="weekly-section wide-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LOOKING AHEAD / 7 DAYS</p>
          <h2>Forecast outlook</h2>
        </div>
        <button className="secondary-btn" type="button">
          AIR QUALITY <ChevronRight size={14} />
        </button>
      </div>
      <div className="weekly-row">
        {entries.map((entry, i) => (
          <div
            className={`day-card ${i === 0 ? 'active' : ''} interactive-forecast-card`}
            key={`day-${entry.day}-${i}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectDay?.(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelectDay?.(i)
              }
            }}
            aria-label={`View forecast details for ${entry.day}, ${entry.condition || ''} High ${entry.high}, Low ${entry.low}`}
          >
            <span>{entry.day}</span>
            <WeatherIcon type={entry.iconType} size={32} />
            <b>{entry.high}</b>
            <small>{entry.low}</small>
            <label>{entry.rainProbability} rain</label>
          </div>
        ))}
      </div>
    </Panel>
  )
}
