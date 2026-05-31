import React from 'react'

interface NavProps {
  ctaLabel?: string
  ctaHref?: string
  children?: React.ReactNode
}

export function Nav({ ctaLabel = 'Apply for Beta', ctaHref = '#cta', children }: NavProps) {
  return (
    <nav className="nav">
      <a href="/" className="nav-logo">
        <div className="nav-logo-bar" />
        TAHTI
      </a>
      {children}
      <a href={ctaHref} className="nav-cta">{ctaLabel.toUpperCase()}</a>
    </nav>
  )
}
