import React from 'react'

export function LiveBadge() {
  return (
    <span className="badge-live">
      <span className="badge-live-dot" />
      LIVE
    </span>
  )
}

export interface QualityBadgeProps { quality: 'FLAC' | 'MP3' | 'OPUS' }
export function QualityBadge({ quality }: QualityBadgeProps) {
  const isMp3 = quality === 'MP3'
  return <span className={`badge-quality${isMp3 ? ' mp3' : ''}`}>{quality}</span>
}

export interface BadgeProps {
  children: React.ReactNode
  variant?: 'cyan' | 'amber' | 'green' | 'purple'
  className?: string
}
export function Badge({ children, variant = 'cyan', className = '' }: BadgeProps) {
  return (
    <span className={`badge-pill ${variant} ${className}`.trim()}>
      {children}
    </span>
  )
}
