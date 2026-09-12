import { Sun } from 'lucide-react'
import { Panel } from '@/components/Panel'
import type { UVData } from '@/lib/types'

interface UVCardProps {
  data: UVData
}

export function UVCard({ data }: UVCardProps) {
  // Fill indicators up to current UV level (1-10 scale)
  const activeBars = Math.min(10, Math.round(data.index))

  return (
    <Panel className="uv-card">
      <div className="panel-heading">
        <h2 style={{ fontSize: '11px', fontWeight: 900, margin: 0, letterSpacing: '0.1em' }}>CURRENT UV INDEX</h2>
        <Sun size={18} aria-hidden="true" />
      </div>
      <div className="uv-value">
        <strong>{data.index}</strong>
        <span>{data.level}</span>
      </div>
      <div className="uv-scale">
        {Array.from({ length: 10 }).map((_, i) => (
          <i
            key={i}
            style={{
              backgroundColor: i < activeBars ? 'var(--ink)' : '#f0f0f0',
              border: '1.5px solid var(--ink)',
            }}
          />
        ))}
      </div>
      {data.maxToday !== undefined && (
        <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em', color: '#666', marginTop: '6px' }}>
          PEAK TODAY: {data.maxToday}
        </div>
      )}
      <p>{data.advice}</p>
    </Panel>
  )
}
