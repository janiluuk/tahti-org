// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PageShell, StatusPill } from '@tahti/ui'
import { MultistreamTargetsPanel } from './multistream-targets-panel'

interface RtmpTarget {
  id: string
  provider: string
  label: string
  rtmpUrl: string
  alwaysMirror: boolean
  enabled: boolean
  keyLast4?: string
}

interface MeResponse {
  tier: string
  channel: { state: string } | null
}

async function apiFetch<T>(apiUrl: string, cookie: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export default async function MultistreamSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [me, targets] = await Promise.all([
    apiFetch<MeResponse>(apiUrl, cookie, '/api/auth/me'),
    apiFetch<RtmpTarget[]>(apiUrl, cookie, '/api/me/rtmp-targets'),
  ])

  const isPaid = me?.tier === 'STUDIO'
  const channelLive = me?.channel?.state === 'LIVE'

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Multistream targets</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Your live broadcast is mirrored to every enabled target. Stream keys are encrypted at
            rest. One source — OBS pushes once, Tahti fans out.
          </p>
        </div>
        <div className="studio-page-header__actions">
          {isPaid ? (
            <StatusPill tone="cyan">PAID · UNLIMITED TARGETS</StatusPill>
          ) : (
            <StatusPill tone="amber">PAID FEATURE</StatusPill>
          )}
        </div>
      </div>

      {isPaid ? (
        <MultistreamTargetsPanel initial={targets ?? []} channelLive={channelLive} />
      ) : (
        <div className="studio-empty-card studio-mt-xl">
          <p className="studio-empty-card__text">Multistream is a Tahti membership feature.</p>
          <p className="studio-empty-card__hint">
            Upgrade to mirror your live broadcast to YouTube, Twitch, Kick, and more —{' '}
            <a href="/dashboard#account">see membership options in Settings</a>.
          </p>
        </div>
      )}
    </PageShell>
  )
}
