import { Zap, ChevronRight } from 'lucide-react'
import { Panel } from '@/components/Panel'
import type { InsightData } from '@/lib/types'

interface InsightCardProps {
  insight: InsightData
}

export function InsightCard({ insight }: InsightCardProps) {
  return (
    <Panel className="insight-card">
      <div className="panel-heading">
        <span>TODAY&apos;S INSIGHT</span>
        <Zap size={18} />
      </div>
      <h2>
        {insight.heading}
        <br />
        <em>{insight.headingEmphasis}</em>
      </h2>
      <p>{insight.description}</p>
      <div className="insight-metrics">
        <div>
          <span>RAIN CHANCE</span>
          <b>{insight.rainChance}</b>
        </div>
        <div>
          <span>WIND</span>
          <b>{insight.wind}</b>
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
