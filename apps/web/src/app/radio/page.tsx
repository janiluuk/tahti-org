// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { AvatarTile, ChannelPageShell, Heading, Row, SafePlainText, Text } from '@tahti/ui'
import {
  resolveActiveRadioPlayback,
  resolveTahtiRadioStream,
  TAHTI_RADIO_SLUG,
} from '@tahti/shared'
import { getSessionUser } from '@/lib/session'
import ChatPanel from '../c/[slug]/chat-panel'
import { RadioPlayerSection } from './radio-player-section'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Tahti Radio — 24/7 live',
  description: 'Community radio on Tahti — always on, with live chat.',
}

interface Announcement {
  id: string
  body: string
  createdAt: string
}

interface RadioChannel {
  slug: string
  artistName: string
}

interface RadioNowPlaying {
  live: boolean
  channel: RadioChannel | null
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/chat/${TAHTI_RADIO_SLUG}/announcements`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return []
    return (await res.json()) as Announcement[]
  } catch {
    return []
  }
}

async function fetchMemberRelay(): Promise<RadioNowPlaying> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/radio`, { next: { revalidate: 30 } })
    if (!res.ok) return { live: false, channel: null }
    return (await res.json()) as RadioNowPlaying
  } catch {
    return { live: false, channel: null }
  }
}

function radioStreamEnv() {
  return {
    TAHTI_RADIO_STREAM_MODE: process.env.TAHTI_RADIO_STREAM_MODE,
    TAHTI_RADIO_VIDEO_URL: process.env.TAHTI_RADIO_VIDEO_URL,
    TAHTI_RADIO_YOUTUBE_URL: process.env.TAHTI_RADIO_YOUTUBE_URL,
    TAHTI_RADIO_AUDIO_URL: process.env.TAHTI_RADIO_AUDIO_URL,
    TAHTI_RADIO_HLS_URL: process.env.TAHTI_RADIO_HLS_URL,
  }
}

export default async function RadioPage() {
  const streamConfig = resolveTahtiRadioStream(radioStreamEnv())
  const playback = resolveActiveRadioPlayback(streamConfig)

  const [announcements, memberRelay, user] = await Promise.all([
    fetchAnnouncements(),
    fetchMemberRelay(),
    getSessionUser(),
  ])

  return (
    <ChannelPageShell
      activeNav="radio"
      showLiveBadge
      user={user}
      main={
        <div className="ch-page-content">
          <div className="ch-page-foreground">
            <header className="ch-artist-header">
              <Row className="ui-row--gap-3 ch-artist-header-row">
                <AvatarTile
                  size="sm"
                  name="Tahti Radio"
                  className="ch-artist-avatar ch-artist-avatar--radio"
                />
                <div>
                  <Heading level={1} className="ch-artist-name">
                    Tahti Radio
                  </Heading>
                  <Text size="sm" tone="muted">
                    @{TAHTI_RADIO_SLUG}
                  </Text>
                </div>
              </Row>
              <SafePlainText
                text="24/7 community radio — always on while we grow the member meta-stream. Tune in and chat with listeners worldwide."
                className="ch-artist-bio"
              />
              <Text size="sm" tone="muted" className="studio-mt-xs">
                Looking for a specific sound? <a href="/listen">Browse live channels by genre</a>.
              </Text>
            </header>

            {playback.kind === 'none' ? (
              <div className="public-empty-card">
                <p className="public-empty-card__text">Tahti Radio is temporarily offline.</p>
                <p className="public-empty-card__hint">
                  <a href="/listen">Browse live channels</a> or check back soon.
                </p>
              </div>
            ) : (
              <RadioPlayerSection playback={playback} slug={TAHTI_RADIO_SLUG} />
            )}

            {memberRelay.live && memberRelay.channel && (
              <section className="ch-next-broadcast" role="status">
                <Text size="sm" tone="muted">
                  Member relay also live:{' '}
                  <a href={`/c/${memberRelay.channel.slug}`} className="ch-artist-profile-link">
                    {memberRelay.channel.artistName}
                  </a>
                </Text>
              </section>
            )}
          </div>
        </div>
      }
      sidebar={<ChatPanel slug={TAHTI_RADIO_SLUG} announcements={announcements} />}
    />
  )
}
