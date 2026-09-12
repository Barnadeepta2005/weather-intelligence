interface PanelProps {
  id?: string
  className?: string
  children: React.ReactNode
}

export function Panel({ id, className = '', children }: PanelProps) {
  return <section id={id} className={`panel ${className}`}>{children}</section>
}
