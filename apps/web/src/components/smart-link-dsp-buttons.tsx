'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const SERVICE_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  apple: 'Apple Music',
  tidal: 'Tidal',
  bandcamp: 'Bandcamp',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube Music',
  deezer: 'Deezer',
  amazon: 'Amazon Music',
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
      {services.map(([key, url]) => (
        <a
          key={key}
          href={url}
          rel="noopener noreferrer"
          className="sl-btn"
          onClick={() => logClick(key)}
        >
          <span className="sl-btn-name">{SERVICE_LABELS[key] ?? key}</span>
          <span className="sl-btn-arrow">→</span>
        </a>
      ))}
    </div>
  )
}
