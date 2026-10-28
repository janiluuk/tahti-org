// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { HeadObjectCommand } from '@aws-sdk/client-s3'
import type { PrismaClient } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { s3 } from './minio.js'

/**
 * Variant playlists Liquidsoap rewrites on every segment (see
 * infra/liquidsoap-*.liq.template). master.m3u8 is deliberately not here: the
 * worker only re-uploads it when its body changes, so it outlives a dead
 * channel as a stale object.
 */
export const LIVE_VARIANT_PLAYLISTS = [
  'stream-mp3-192.m3u8',
  'stream-aac-320.m3u8',
  'stream-flac.m3u8',
] as const

export interface LiveChannelSnapshot {
  slug: string
  broadcastStartedAt: Date
  /** 24/7 channels (Tahti Radio, curated rotations) make a silent stream critical. */
  alwaysOn: boolean
}

export interface SilentLiveChannel {
  slug: string
  alwaysOn: boolean
  /** Null when no variant playlist exists at all. */
  silentForMs: number | null
}

export interface LiveStreamsCheckOptions {
  staleMs: number
  graceMs: number
  now: number
}

/** Newest variant playlist upload time for a channel, or null when none exists. */
export type NewestPlaylistLookup = (slug: string) => Promise<number | null>

export function findSilentLiveChannels(
  channels: LiveChannelSnapshot[],
  newestPlaylistAt: Map<string, number | null>,
  { staleMs, graceMs, now }: LiveStreamsCheckOptions,
): SilentLiveChannel[] {
  const silent: SilentLiveChannel[] = []
  for (const ch of channels) {
    if (now - ch.broadcastStartedAt.getTime() < graceMs) continue
    const newest = newestPlaylistAt.get(ch.slug) ?? null
    if (newest === null) {
      silent.push({ slug: ch.slug, alwaysOn: ch.alwaysOn, silentForMs: null })
      continue
    }
    const age = now - newest
    if (age > staleMs) silent.push({ slug: ch.slug, alwaysOn: ch.alwaysOn, silentForMs: age })
  }
  return silent
}

export function formatSilentDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const totalMin = Math.floor(totalSec / 60)
  if (totalMin < 60) return `${totalMin}m`
  return `${Math.floor(totalMin / 60)}h ${totalMin % 60}m`
}

export function describeSilentChannels(silent: SilentLiveChannel[]): string {
  return silent
    .map((s) =>
      s.silentForMs === null
        ? `${s.slug} no playlist`
        : `${s.slug} silent ${formatSilentDuration(s.silentForMs)}`,
    )
    .join('; ')
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404
}

export function newestPlaylistFromMinio(bucket: string): NewestPlaylistLookup {
  return async (slug) => {
    const times = await Promise.all(
      LIVE_VARIANT_PLAYLISTS.map(async (name) => {
        try {
          const head = await s3.send(
            new HeadObjectCommand({ Bucket: bucket, Key: `${slug}/${name}` }),
          )
          return head.LastModified?.getTime() ?? null
        } catch (err) {
          if (isNotFound(err)) return null
          throw err
        }
      }),
    )
    const present = times.filter((t): t is number => t !== null)
    return present.length > 0 ? Math.max(...present) : null
  }
}

export async function loadLiveChannels(prisma: PrismaClient): Promise<LiveChannelSnapshot[]> {
  const rows = await prisma.channel.findMany({
    where: { state: 'LIVE', broadcasts: { some: { endedAt: null } } },
    select: {
      slug: true,
      broadcasts: {
        where: { endedAt: null },
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { startedAt: true },
      },
      curatedRotationItems: { select: { id: true }, take: 1 },
    },
  })
  return rows.flatMap((row) => {
    const broadcast = row.broadcasts[0]
    if (!broadcast) return []
    return [
      {
        slug: row.slug,
        broadcastStartedAt: broadcast.startedAt,
        // Same rule the orchestrator uses to pick the rotation template.
        alwaysOn: row.slug === TAHTI_RADIO_SLUG || row.curatedRotationItems.length > 0,
      },
    ]
  })
}

export interface LiveStreamsResult {
  checked: number
  /** Whether any checked channel is 24/7, i.e. whether this check is currently critical. */
  alwaysOnChecked: boolean
  silent: SilentLiveChannel[]
}

export async function probeLiveStreams(
  channels: LiveChannelSnapshot[],
  lookup: NewestPlaylistLookup,
  options: LiveStreamsCheckOptions,
): Promise<LiveStreamsResult> {
  const due = channels.filter(
    (ch) => options.now - ch.broadcastStartedAt.getTime() >= options.graceMs,
  )
  const entries = await Promise.all(
    due.map(async (ch) => [ch.slug, await lookup(ch.slug)] as const),
  )
  return {
    checked: due.length,
    alwaysOnChecked: due.some((ch) => ch.alwaysOn),
    silent: findSilentLiveChannels(channels, new Map(entries), options),
  }
}
