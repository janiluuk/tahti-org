'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

function IconSpotify() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2.5 5c3.5-2.2 7.5-2.2 11 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 8c3-1.8 7-1.8 10 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 11c2-1.2 6-1.2 8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconApple() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6.5 11.5V5l6-1.5v2.5L6.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5" cy="11.5" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconSoundCloud() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 11h11a2.5 2.5 0 0 0 0-5 4 4 0 0 0-7.5-1.5A2.5 2.5 0 0 0 2 8v3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function IconTidal() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 7.5c1-1.5 2-1.5 3 0s2 1.5 3 0 2-1.5 3 0 2 1.5 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2 10c1-1.5 2-1.5 3 0s2 1.5 3 0 2-1.5 3 0 2 1.5 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function IconBandcamp() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 11l4-6h4l-4 6H2z" fill="currentColor" />
      <path d="M8 11l4-6h2l-4 6H8z" fill="currentColor" />
    </svg>
  )
}

function IconYoutube() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="3.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.5 6l4 2-4 2V6z" fill="currentColor" />
    </svg>
  )
}

function IconDeezer() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="9" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="5.5" y="6.5" width="2" height="6.5" rx="1" fill="currentColor" />
      <rect x="9" y="4" width="2" height="9" rx="1" fill="currentColor" />
      <rect x="12.5" y="7" width="2" height="6" rx="1" fill="currentColor" />
    </svg>
  )
}

function IconAmazon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 9.5c2.5 2.5 7.5 2.5 10 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12.5 11.5l1.5-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function IconTahti() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2l1.6 4.2H14l-3.5 2.6 1.3 4.2L8 10.5l-3.8 2.5 1.3-4.2L2 6.2h4.4z"
        fill="currentColor"
      />
    </svg>
  )
}

function IconLink() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M7 9a3.5 3.5 0 0 0 5 0l1.5-1.5a3.5 3.5 0 0 0-5-5L7 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 7a3.5 3.5 0 0 0-5 0L2.5 8.5a3.5 3.5 0 0 0 5 5L9 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

const SERVICE_META: Record<string, { label: string; action: string; icon: ReactNode }> = {
  spotify: { label: 'Spotify', action: 'Stream', icon: <IconSpotify /> },
  apple: { label: 'Apple Music', action: 'Stream', icon: <IconApple /> },
  tidal: { label: 'Tidal', action: 'Stream', icon: <IconTidal /> },
  bandcamp: { label: 'Bandcamp', action: 'Buy / Free DL', icon: <IconBandcamp /> },
  soundcloud: { label: 'SoundCloud', action: 'Stream', icon: <IconSoundCloud /> },
  youtube: { label: 'YouTube Music', action: 'Stream', icon: <IconYoutube /> },
  deezer: { label: 'Deezer', action: 'Stream', icon: <IconDeezer /> },
  amazon: { label: 'Amazon Music', action: 'Stream', icon: <IconAmazon /> },
  tahti: { label: 'tahti.fi', action: 'FLAC · best quality', icon: <IconTahti /> },
}

type Props = {
  smartLinkSlug: string
  targets: Record<string, string>
}

export function SmartLinkDspButtons({ smartLinkSlug, targets }: Props) {
  const services = Object.entries(targets).filter(([, url]) => url?.trim())

  function logClick(platform: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
    void fetch(`${apiBase}/api/smartlink/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smartLinkSlug,
        platform,
        referer: typeof document !== 'undefined' ? document.referrer : undefined,
      }),
      keepalive: true,
    }).catch(() => undefined)
  }

  if (services.length === 0) return null

  return (
    <div className="sl-btns">
      {services.map(([key, url]) => {
        const meta = SERVICE_META[key] ?? { label: key, action: 'Listen', icon: <IconLink /> }
        const isPrimary = key === 'tahti'
        return (
          <a
            key={key}
            href={url}
            rel="noopener noreferrer"
            className={`sl-btn${isPrimary ? ' sl-btn--primary' : ''}`}
            onClick={() => logClick(key)}
          >
            <span className={`sl-btn-icon sl-btn-icon--${key}`} aria-hidden>
              {meta.icon}
            </span>
            <span className="sl-btn-name">{meta.label}</span>
            <span className="sl-btn-action">{meta.action}</span>
            <span className="sl-btn-arrow">→</span>
          </a>
        )
      })}
    </div>
  )
}
