'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const SERVICE_META: Record<string, { label: string; action: string; iconBg: string }> = {
  spotify: { label: 'Spotify', action: 'Stream', iconBg: '#1DB954' },
  apple: { label: 'Apple Music', action: 'Stream', iconBg: '#FC3C44' },
  tidal: { label: 'Tidal', action: 'Stream', iconBg: '#000000' },
  bandcamp: { label: 'Bandcamp', action: 'Buy / Free DL', iconBg: '#1DA0C3' },
  soundcloud: { label: 'SoundCloud', action: 'Stream', iconBg: '#FF5500' },
  youtube: { label: 'YouTube Music', action: 'Stream', iconBg: '#FF0000' },
  deezer: { label: 'Deezer', action: 'Stream', iconBg: '#A238FF' },
  amazon: { label: 'Amazon Music', action: 'Stream', iconBg: '#25D1DA' },
  tahti: { label: 'tahti.fi', action: 'FLAC · best quality', iconBg: '#F5A623' },
}

// Simple letter icons; keep SVG-free to avoid bundle bloat
function ServiceIcon({ service, bg }: { service: string; bg: string }) {
  const initials: Record<string, string> = {
    spotify: 'S',
    apple: 'A',
    tidal: 'T',
    bandcamp: 'B',
    soundcloud: 'SC',
    youtube: 'YT',
    deezer: 'D',
    amazon: 'AM',
    tahti: '★',
  }
  return (
    <span className="sl-btn-icon" style={{ background: bg }} aria-hidden>
      {initials[service] ?? service.slice(0, 1).toUpperCase()}
    </span>
  )
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
        const meta = SERVICE_META[key] ?? { label: key, action: 'Listen', iconBg: '#444' }
        return (
          <a
            key={key}
            href={url}
            rel="noopener noreferrer"
            className="sl-btn"
            onClick={() => logClick(key)}
          >
            <ServiceIcon service={key} bg={meta.iconBg} />
            <span className="sl-btn-name">{meta.label}</span>
            <span className="sl-btn-action">{meta.action}</span>
            <span className="sl-btn-arrow">→</span>
          </a>
        )
      })}
    </div>
  )
}
