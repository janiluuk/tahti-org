// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { AvatarTile, ChannelPageShell, Heading, Row, SafePlainText, Text } from '@tahti/ui'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { getSessionUser } from '@/lib/session'
import { BroadcastCountdown } from '@/components/broadcast-countdown'
import ChatPanel from '../c/[slug]/chat-panel'
import { RadioPlayerSection } from './radio-player-section'
import { listPublicRadioSlots, type PublicRadioSlot } from './actions'

const NEXT_LIVE_ANNOUNCE_WINDOW_MS = 2 * 60 * 60 * 1000

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

interface RadioRotationItem {
  id: string
  title: string
  artistName: string
  artistUsername: string
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

async function fetchRotation(): Promise<RadioRotationItem[]> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/v1/radio/rotation`, { next: { revalidate: 60 } })
    if (!res.ok) return []
    return (await res.json()) as RadioRotationItem[]
  } catch {
    return []
  }
}

async function fetchUpcomingSlots(): Promise<PublicRadioSlot[]> {
  const now = new Date()
  const to = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000)
  const { slots } = await listPublicRadioSlots(now.toISOString(), to.toISOString())
  return slots
}

interface RadioChannelPayload {
  hlsUrl: string | null
  nowPlaying: { title: string; artistName: string; artworkUrl: string | null } | null
}

/** Real HLS output from Tahti Radio's own always-on Liquidsoap process (spawned
 * and kept in sync by the radio-slot-switchover cron): the booked artist's live
 * feed during their slot, the curated rotation otherwise. This is the only
 * source the public page ever plays — no video/YouTube placeholder fallback.
 * Also carries the orchestrator's rotation now-playing sync (STREAM-012). */
async function fetchRadioChannel(): Promise<RadioChannelPayload> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/channels/${TAHTI_RADIO_SLUG}`, {
      next: { revalidate: 30 },
    })
    if (!res.ok) return { hlsUrl: null, nowPlaying: null }
    return (await res.json()) as RadioChannelPayload
  } catch {
    return { hlsUrl: null, nowPlaying: null }
  }
}

export default async function RadioPage() {
  const [announcements, memberRelay, rotation, upcomingSlots, radioChannel, user] =
    await Promise.all([
      fetchAnnouncements(),
      fetchMemberRelay(),
      fetchRotation(),
      fetchUpcomingSlots(),
      fetchRadioChannel(),
      getSessionUser(),
    ])
  const { hlsUrl: realHlsUrl, nowPlaying } = radioChannel

  const playback = realHlsUrl
    ? ({ kind: 'audio', audioUrl: realHlsUrl } as const)
    : ({ kind: 'none' } as const)

  const now = Date.now()
  const liveSlot = upcomingSlots.find(
    (s) => new Date(s.startAt).getTime() <= now && new Date(s.endAt).getTime() > now,
  )
  const nextSlot = upcomingSlots.find((s) => new Date(s.startAt).getTime() > now)
  const showNextLiveAnnouncement =
    !liveSlot &&
    nextSlot &&
    new Date(nextSlot.startAt).getTime() - now <= NEXT_LIVE_ANNOUNCE_WINDOW_MS

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
              <div className="ch-radio-description">
                <SafePlainText text="24/7 community radio — always on while we grow the member meta-stream. Tune in and chat with listeners worldwide." />
              </div>
              <Text size="sm" tone="muted" className="studio-mt-xs">
                Looking for a specific sound? <Link href="/listen">Browse live channels by genre</Link>.
              </Text>
            </header>

            {liveSlot && (
              <p className="ch-radio-live-now" role="status">
                🔴 Live now: <strong>{liveSlot.artist.displayName}</strong>
                {liveSlot.artist.channelSlug && (
                  <>
                    {' — '}
                    <Link href={`/u/${liveSlot.artist.username}`}>view artist page</Link>
                  </>
                )}
              </p>
            )}

            {showNextLiveAnnouncement && nextSlot && (
              <BroadcastCountdown
                targetIso={nextSlot.startAt}
                note={`${nextSlot.artist.displayName}${nextSlot.note ? ` — ${nextSlot.note}` : ''}`}
              />
            )}

            {playback.kind === 'none' ? (
              <div className="public-empty-card">
                <p className="public-empty-card__text">Tahti Radio is temporarily offline.</p>
                <p className="public-empty-card__hint">
                  <Link href="/listen">Browse live channels</Link> or check back soon.
                </p>
              </div>
            ) : (
              <RadioPlayerSection
                playback={playback}
                slug={TAHTI_RADIO_SLUG}
                rotation={rotation}
                slots={upcomingSlots}
                isLoggedIn={!!user}
                liveSlot={liveSlot ? { startAt: liveSlot.startAt, artist: liveSlot.artist } : null}
                nowPlaying={nowPlaying}
                memberRelay={
                  memberRelay.live && memberRelay.channel
                    ? { slug: memberRelay.channel.slug, artistName: memberRelay.channel.artistName }
                    : null
                }
              />
            )}
          </div>
        </div>
      }
      sidebar={<ChatPanel slug={TAHTI_RADIO_SLUG} announcements={announcements} />}
    />
  )
}
