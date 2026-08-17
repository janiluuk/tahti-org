// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import NextLink from 'next/link'
import { ButtonIcon, StatusPill } from '@tahti/ui'
import { createTahtiClient } from '@tahti/api-client'
import { MultistreamTargetsPanel } from './multistream-targets-panel'
import { StreamOverlayPanel } from './stream-overlay-panel'

export default async function MultistreamSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const api = createTahtiClient({ baseUrl: apiUrl, cookie: `tahti_session=${sessionCookie.value}` })

  const [me, targets, overlay] = await Promise.all([
    api.GET('/api/auth/me').then((r) => r.data),
    api.GET('/api/me/rtmp-targets').then((r) => r.data),
    api.GET('/api/me/channel/stream-overlay').then((r) => r.data),
  ])

  const isPaid = me?.tier === 'STUDIO'
  const channelLive = me?.channel?.state === 'LIVE'

  return (
    <>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Multistream targets</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Your live broadcast is mirrored to every enabled target. Stream keys are encrypted at
            rest. One source — OBS pushes once, Tahti fans out.
          </p>
        </div>
        {isPaid && (
          <div className="studio-page-header__actions">
            <StatusPill tone="cyan">PAID · UNLIMITED TARGETS</StatusPill>
          </div>
        )}
      </div>

      {isPaid ? (
        <>
          <MultistreamTargetsPanel initial={targets ?? []} channelLive={channelLive} />
          <StreamOverlayPanel
            initial={
              overlay ?? {
                streamOverlayTitle: null,
                streamOverlaySubtitle: null,
                streamOverlayCoverUrl: null,
              }
            }
          />
        </>
      ) : (
        <div className="studio-empty-card studio-mt-xl">
          <p className="studio-empty-card__text">Multistream is a Tahti Studio-plan feature.</p>
          <p className="studio-empty-card__hint">
            Upgrade to Studio to mirror your live broadcast to YouTube, Twitch, Kick, and more.
          </p>
          <NextLink
            href="/dashboard/settings/account"
            className="ui-btn ui-btn--primary studio-mt-sm"
          >
            <ButtonIcon name="link" />
            View plans →
          </NextLink>
        </div>
      )}
    </>
  )
}
