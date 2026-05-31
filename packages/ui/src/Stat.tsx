import React from 'react'

type Accent = 'amber' | 'cyan' | 'green' | 'lavender'

interface StatProps {
  value: string
  label: string
  accent?: Accent
}

export function Stat({ value, label, accent = 'amber' }: StatProps) {
  return (
    <div className="stat">
      <div className={`stat-value ${accent !== 'amber' ? accent : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

interface StatGridProps { children: React.ReactNode; cols?: 2 | 3 | 4 }
export function StatGrid({ children, cols = 4 }: StatGridProps) {
  return <div className={`grid-${cols}`}>{children}</div>
}
