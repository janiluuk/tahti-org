import React from 'react'

type Accent = 'amber' | 'cyan' | 'green' | 'purple' | 'coral' | 'lavender'

export interface SectionHeaderProps {
  label?: string
  heading: string
  subtitle: string
  subtitleAccent?: Accent
  lead?: string
  className?: string
}

export function SectionHeader({
  label,
  heading,
  subtitle,
  subtitleAccent = 'amber',
  lead,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={className}>
      {label && <div className="s-label">{label}</div>}
      <h2 className="s-h2">{heading}</h2>
      <div className={`s-sub ${subtitleAccent !== 'amber' ? subtitleAccent : ''}`}>{subtitle}</div>
      {lead && <p className="s-lead">{lead}</p>}
    </div>
  )
}
