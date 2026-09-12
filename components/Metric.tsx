interface MetricProps {
  label: string
  value: string
  meta: string
  icon: React.ReactNode
}

export function Metric({ label, value, meta, icon }: MetricProps) {
  return (
    <div className="metric-tile">
      <span className="metric-label">{icon}{label}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </div>
  )
}
