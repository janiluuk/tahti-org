// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Prisma, PrismaClient } from '@tahti/db'
import {
  computeListeningPartyTimeline,
  containsEmailAddress,
  listeningPartyDurationSec,
  type ListeningPartyDto,
  type ListeningPartySummaryDto,
  type ListeningPartyTimeline,
} from '@tahti/shared'
import { resolveReleaseArtworkUrl } from './release-artwork.js'
import { userName } from './safe-names.js'

export const listeningPartySelect = {
  id: true,
  releaseId: true,
  channelId: true,
  hostUserId: true,
  startAt: true,
  hostNote: true,
  canceledAt: true,
  channel: {
    select: {
      slug: true,
      storeEnabled: true,
      user: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  },
  host: { select: { username: true, displayName: true, avatarUrl: true } },
  release: {
    select: {
      id: true,
      userId: true,
      title: true,
      type: true,
      artworkUrl: true,
      artworkKey: true,
      smartLinkSlug: true,
      releaseDate: true,
      state: true,
      description: true,
      commentary: true,
      credits: true,
      pLine: true,
      cLine: true,
      labelImprint: true,
      tracks: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          title: true,
          durationSec: true,
          credits: true,
        },
      },
    },
  },
} satisfies Prisma.ListeningPartySelect

export type ListeningPartyRow = Prisma.ListeningPartyGetPayload<{
  select: typeof listeningPartySelect
}>

/** A release nobody outside the party may stream yet: not published, or
 * published with a release date still ahead. */
export function isPreRelease(
  release: { state: string; releaseDate: Date | null },
  now: Date,
): boolean {
  if (release.state !== 'PUBLISHED') return true
  return release.releaseDate !== null && release.releaseDate.getTime() > now.getTime()
}

export function partyTimeline(
  party: Pick<ListeningPartyRow, 'startAt' | 'canceledAt'> & {
    release: { tracks: { id: string; position: number; durationSec: number | null }[] }
  },
  now: Date,
): ListeningPartyTimeline {
  return computeListeningPartyTimeline({
    startAt: party.startAt,
    tracks: party.release.tracks,
    canceledAt: party.canceledAt,
    now,
  })
}

type Credit = { role: string; name: string; artistUsername?: string | null }

/** Credits are free text typed by the artist; anything that isn't a
 * well-formed credit, or names someone by email address, is left out. */
function publicCredits(raw: unknown): Credit[] {
  if (!Array.isArray(raw)) return []
  const out: Credit[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const { role, name, artistUsername } = entry as Record<string, unknown>
    if (typeof role !== 'string' || typeof name !== 'string' || !name.trim()) continue
    if (containsEmailAddress(name)) continue
    out.push({
      role,
      name,
      artistUsername: typeof artistUsername === 'string' ? artistUsername : null,
    })
  }
  return out
}

/** The channel has no name of its own; it goes by its owner's public name. */
function channelView(party: ListeningPartyRow) {
  return {
    slug: party.channel.slug,
    name: userName(party.channel.user),
    avatarUrl: party.channel.user.avatarUrl,
  }
}

export async function buildListeningPartySummary(
  party: ListeningPartyRow,
  now: Date,
): Promise<ListeningPartySummaryDto> {
  const timeline = partyTimeline(party, now)
  return {
    id: party.id,
    state: timeline.state,
    startAt: party.startAt.toISOString(),
    endAt: timeline.endAt.toISOString(),
    release: {
      id: party.release.id,
      title: party.release.title,
      artworkUrl: await resolveReleaseArtworkUrl(party.release),
    },
    channel: { slug: party.channel.slug, name: userName(party.channel.user) },
  }
}

export async function buildListeningPartyDto(
  prisma: PrismaClient,
  party: ListeningPartyRow,
  now: Date,
): Promise<ListeningPartyDto> {
  const timeline = partyTimeline(party, now)
  const { release } = party
  const preRelease = isPreRelease(release, now)
  const purchaseTiers = await hostPurchaseTiers(prisma, party)

  return {
    id: party.id,
    state: timeline.state,
    startAt: party.startAt.toISOString(),
    endAt: timeline.endAt.toISOString(),
    serverNow: now.toISOString(),
    hostNote: party.hostNote,
    channel: channelView(party),
    host: {
      username: party.host.username,
      displayName: userName(party.host),
      avatarUrl: party.host.avatarUrl,
    },
    release: {
      id: release.id,
      title: release.title,
      type: release.type,
      artworkUrl: await resolveReleaseArtworkUrl(release),
      // The smart link page only resolves published releases.
      smartLinkSlug: release.state === 'PUBLISHED' ? release.smartLinkSlug : null,
      releaseDate: release.releaseDate ? release.releaseDate.toISOString() : null,
      isPreRelease: preRelease,
      description: release.description,
      commentary: release.commentary,
      credits: publicCredits(release.credits),
      pLine: release.pLine,
      cLine: release.cLine,
      labelImprint: release.labelImprint,
    },
    tracks: release.tracks.map((t) => ({
      id: t.id,
      position: t.position,
      title: t.title,
      durationSec: t.durationSec ?? 0,
      credits: publicCredits(t.credits),
    })),
    nowPlaying: timeline.nowPlaying,
    purchaseTiers,
  }
}

async function hostPurchaseTiers(
  _prisma: PrismaClient,
  _party: ListeningPartyRow,
): Promise<ListeningPartyDto['purchaseTiers']> {
  return []
}

// Bounds the overlap query so ended parties don't pile up in it. A party that
// started further back than this would need a release over a week long to
// still be playing.
const OVERLAP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

/** Parties on a channel whose play window overlaps [startAt, endAt). */
export async function findOverlappingParty(
  db: Pick<PrismaClient, 'listeningParty'>,
  args: { channelId: string; startAt: Date; endAt: Date; excludeId?: string },
): Promise<{ id: string } | null> {
  const candidates = await db.listeningParty.findMany({
    where: {
      channelId: args.channelId,
      canceledAt: null,
      startAt: { lt: args.endAt, gte: new Date(args.startAt.getTime() - OVERLAP_LOOKBACK_MS) },
      ...(args.excludeId ? { id: { not: args.excludeId } } : {}),
    },
    select: {
      id: true,
      startAt: true,
      release: { select: { tracks: { select: { durationSec: true } } } },
    },
  })
  for (const c of candidates) {
    const endMs = c.startAt.getTime() + listeningPartyDurationSec(c.release.tracks) * 1000
    if (endMs > args.startAt.getTime()) return { id: c.id }
  }
  return null
}
