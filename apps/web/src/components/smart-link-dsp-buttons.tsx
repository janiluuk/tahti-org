'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const SERVICE_META: Record<string, { label: string; action: string; emoji: string }> = {
  spotify: { label: 'Spotify', action: 'Stream', emoji: '🎵' },
  apple: { label: 'Apple Music', action: 'Stream', emoji: '🍎' },
  tidal: { label: 'Tidal', action: 'Stream', emoji: '🌊' },
  bandcamp: { label: 'Bandcamp', action: 'Buy / Free DL', emoji: '💿' },
  soundcloud: { label: 'SoundCloud', action: 'Stream', emoji: '☁️' },
  youtube: { label: 'YouTube Music', action: 'Stream', emoji: '▶️' },
  deezer: { label: 'Deezer', action: 'Stream', emoji: '🎧' },
  amazon: { label: 'Amazon Music', action: 'Stream', emoji: '🛒' },
  tahti: { label: 'tahti.fi', action: 'FLAC · best quality', emoji: '★' },
}

function ServiceIcon({ service, emoji }: { service: string; emoji: string }) {
  return (
    <span className={`sl-btn-icon sl-btn-icon--${service}`} aria-hidden>
      {emoji}
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
        const meta = SERVICE_META[key] ?? { label: key, action: 'Listen', emoji: '🔗' }
        const isPrimary = key === 'tahti'
        return (
          <a
            key={key}
            href={url}
            rel="noopener noreferrer"
            className={`sl-btn${isPrimary ? ' sl-btn--primary' : ''}`}
            onClick={() => logClick(key)}
          >
            <ServiceIcon service={key} emoji={meta.emoji} />
            <span className="sl-btn-name">{meta.label}</span>
            <span className="sl-btn-action">{meta.action}</span>
            <span className="sl-btn-arrow">→</span>
          </a>
        )
      })}
    </div>
  )
}
