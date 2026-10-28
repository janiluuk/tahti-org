// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { computeListeningPartyTimeline } from '@tahti/shared'

/** Same bound as the API's PARTY_LOOKBACK_MS: a party that started earlier
 * than this can't still be playing. */
const PARTY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

export interface ListeningPartyAnnounceSummary {
  live: number
  announced: number
  failed: number
}

export interface ChatSystemMessage {
  slug: string
  text: string
}

export type ChatPublisher = (message: ChatSystemMessage) => Promise<void>

/** Publishes straight to Centrifugo, like the API's "loved" announcements:
 * system lines skip the publish proxy and are not stored as ChatMessage rows. */
export const publishToCentrifugo: ChatPublisher = async ({ slug, text }) => {
  const res = await fetch(process.env.CENTRIFUGO_API_URL ?? 'http://localhost:8000/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `apikey ${process.env.CENTRIFUGO_API_KEY ?? 'dev'}`,
    },
    body: JSON.stringify({
      method: 'publish',
      params: {
        channel: `channel:${slug}`,
        data: { handle: 'Tahti', text, system: true, ts: Date.now() },
      },
    }),
  })
  if (!res.ok) throw new Error(`Centrifugo publish failed: ${res.status}`)
}

export function nowPlayingText(index: number, total: number, title: string): string {
  return `Now playing ${index}/${total} · ${title}`
}

/**
 * Posts "Now playing 3/10 · Title" in the host channel's chat when a party
 * moves to a new track. Only the current track is announced: a tick that
 * missed a short track does not post it late.
 */
export async function processListeningPartyAnnounceJob(
  prisma: PrismaClient,
  publish: ChatPublisher = publishToCentrifugo,
  now: Date = new Date(),
): Promise<ListeningPartyAnnounceSummary> {
  const parties = await prisma.listeningParty.findMany({
    where: {
      canceledAt: null,
      startAt: { lte: now, gte: new Date(now.getTime() - PARTY_LOOKBACK_MS) },
    },
    select: {
      id: true,
      startAt: true,
      announcedPosition: true,
      channel: { select: { slug: true, user: { select: { chatEnabled: true } } } },
      release: {
        select: {
          tracks: {
            orderBy: { position: 'asc' },
            select: { id: true, position: true, title: true, durationSec: true },
          },
        },
      },
    },
  })

  const summary: ListeningPartyAnnounceSummary = { live: 0, announced: 0, failed: 0 }
  for (const party of parties) {
    const { tracks } = party.release
    const { state, nowPlaying } = computeListeningPartyTimeline({
      startAt: party.startAt,
      tracks,
      now,
    })
    if (state !== 'LIVE' || !nowPlaying) continue
    summary.live += 1
    if (!party.channel.user.chatEnabled) continue
    if (party.announcedPosition !== null && party.announcedPosition >= nowPlaying.position) {
      continue
    }

    const claimed = await prisma.listeningParty.updateMany({
      where: {
        id: party.id,
        OR: [{ announcedPosition: null }, { announcedPosition: { lt: nowPlaying.position } }],
      },
      data: { announcedPosition: nowPlaying.position },
    })
    if (claimed.count === 0) continue

    const index = tracks.findIndex((t) => t.id === nowPlaying.trackId) + 1
    const track = tracks[index - 1]!
    try {
      await publish({
        slug: party.channel.slug,
        text: nowPlayingText(index, tracks.length, track.title),
      })
      summary.announced += 1
    } catch (err) {
      // The claim stays: a missed chat line is better than a repeated one.
      console.warn('[worker] listening-party-announce publish failed:', party.id, err)
      summary.failed += 1
    }
  }
  return summary
}
