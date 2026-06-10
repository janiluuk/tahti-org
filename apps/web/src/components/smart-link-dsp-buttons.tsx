'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { DspLinkButton, DspLinkButtonList, type DspPlatform } from '@tahti/ui'

const SERVICE_META: Record<string, { label: string; verb: string; platform: DspPlatform }> = {
  spotify: { label: 'Spotify', verb: 'Stream', platform: 'spotify' },
  apple: { label: 'Apple Music', verb: 'Stream', platform: 'apple' },
  tidal: { label: 'Tidal', verb: 'Stream', platform: 'tidal' },
  bandcamp: { label: 'Bandcamp', verb: 'Buy / Free DL', platform: 'bandcamp' },
  soundcloud: { label: 'SoundCloud', verb: 'Stream', platform: 'soundcloud' },
  youtube: { label: 'YouTube Music', verb: 'Stream', platform: 'youtube' },
  deezer: { label: 'Deezer', verb: 'Stream', platform: 'deezer' },
  amazon: { label: 'Amazon Music', verb: 'Stream', platform: 'amazon' },
  tahti: { label: 'tahti.live', verb: 'FLAC · best quality', platform: 'tahti' },
}

function toPlatform(key: string): DspPlatform {
  return SERVICE_META[key]?.platform ?? 'generic'
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
    <DspLinkButtonList>
      {services.map(([key, url]) => {
        const meta = SERVICE_META[key] ?? { label: key, verb: 'Listen', platform: toPlatform(key) }
        return (
          <DspLinkButton
            key={key}
            href={url}
            platform={meta.platform}
            label={meta.label}
            verb={meta.verb}
            primary={key === 'tahti'}
            onClick={() => logClick(key)}
          />
        )
      })}
    </DspLinkButtonList>
  )
}
