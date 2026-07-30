// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { prisma } from '@tahti/db'
import { playbackKeyFromLocalCacheBasename } from '@tahti/shared'
import { getActiveChannelEntries } from './liquidsoap.js'
import {
  LIQUIDSOAP_NOW_PLAYING_COMMAND,
  parseLiquidsoapTelnetResponse,
  sendLiquidsoapTelnetCommand,
} from './liquidsoap-shutdown.js'

const NOW_PLAYING_POLL_INTERVAL_MS = parseInt(
  process.env.NOW_PLAYING_POLL_INTERVAL_MS ?? '20000',
  10,
)
const MINIO_PUBLIC_ENDPOINT = process.env.MINIO_PUBLIC_ENDPOINT ?? 'http://localhost:19000'
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? 'tahti'

/** Extract the MinIO object key from a presigned CDN URL by stripping the known
 * public-endpoint+bucket prefix and any query string (presigned auth params). */
export function objectKeyFromUrl(url: string): string | null {
  const prefix = `${MINIO_PUBLIC_ENDPOINT}/${MINIO_BUCKET}/`
  if (!url.startsWith(prefix)) return null
  const key = url.slice(prefix.length).split('?')[0]
  return key || null
}

/** Liquidsoap's on_metadata "filename" key is a local ffmpeg decode temp file
 * for HTTP-sourced playlist entries — useless for identifying the track.
 * "initial_uri" carries the real request, but wrapped in an
 * `annotate:key="val",...:SOURCE` prefix for entries with inline metadata (our
 * fallback M3U sets title/duration this way) — confirmed by dumping every
 * metadata key against a real production track rather than guessing.
 *
 * SOURCE is either a presigned http(s) URL (remote M3U) or an absolute
 * `/archive-cache/...` path (STREAM-009 local cache). */
export function trackSourceFromMetadata(initialUri: string): string | null {
  const trimmed = initialUri.trim()
  if (!trimmed) return null

  const http = trimmed.match(/https?:\/\/\S+$/)
  if (http) return http[0]

  // Local cache playlist entry, e.g.
  // annotate:extinf_duration="96",song="A Ghost Waltz":/archive-cache/ch/mp3__a__b.mp3
  const local = trimmed.match(/:(\/archive-cache\/\S+)$/)
  if (local) return local[1]

  if (trimmed.startsWith('/archive-cache/')) return trimmed
  return null
}

/** @deprecated Use {@link trackSourceFromMetadata} — kept for call sites/tests that
 * only care about the remote-URL case. */
export function trackUrlFromMetadata(initialUri: string): string | null {
  const source = trackSourceFromMetadata(initialUri)
  return source && /^https?:\/\//.test(source) ? source : null
}

/** Resolve a Liquidsoap initial_uri (annotate-wrapped or bare) to a MinIO object key. */
export function playbackKeyFromMetadata(initialUri: string): string | null {
  const source = trackSourceFromMetadata(initialUri)
  if (!source) return null

  if (/^https?:\/\//.test(source)) return objectKeyFromUrl(source)

  const basename = source.split('/').pop()
  if (!basename) return null
  return playbackKeyFromLocalCacheBasename(basename)
}

async function syncChannelNowPlaying(channelId: string, containerName: string): Promise<void> {
  let raw: string
  try {
    raw = await sendLiquidsoapTelnetCommand(containerName, LIQUIDSOAP_NOW_PLAYING_COMMAND)
  } catch {
    // Container not reachable this cycle (mid-restart, telnet not up yet, etc.) —
    // leave the last-known value in place and try again on the next tick.
    return
  }

  const initialUri = parseLiquidsoapTelnetResponse(raw)
  if (!initialUri) return

  const key = playbackKeyFromMetadata(initialUri)
  if (!key) return

  const item = await prisma.archiveItem.findFirst({
    where: { OR: [{ mp3Key: key }, { flacKey: key }] },
    select: {
      id: true,
      title: true,
      artistName: true,
      bannerUrl: true,
      channel: { select: { user: { select: { displayName: true, username: true } } } },
    },
  })
  if (!item) return

  // Curated/compilation tracks (e.g. Tahti Selects' CC0 rotation) carry their
  // own artistName override — the channel that hosts them isn't who made them,
  // so there's no real profile to link the name to either.
  const artistName = item.artistName ?? item.channel.user.displayName
  const artistUsername = item.artistName ? null : item.channel.user.username

  const current = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { nowPlayingTitle: true, nowPlayingArtistUsername: true },
  })
  const trackChanged =
    current?.nowPlayingTitle !== item.title || current?.nowPlayingArtistUsername !== artistUsername

  await prisma.channel.update({
    where: { id: channelId },
    data: {
      nowPlayingTitle: item.title,
      nowPlayingArtistName: artistName,
      nowPlayingArtistUsername: artistUsername,
      nowPlayingArtworkUrl: item.bannerUrl,
      nowPlayingUpdatedAt: new Date(),
    },
  })

  // "Recently played" history — one row per actual track change, not one per
  // 20s poll of the same still-playing track. Also counts as a "play" for the
  // Manage panel's stats (STREAM-012 rotation plays only — a live broadcast's
  // own listen count is tracked separately via presence, not a "play").
  if (trackChanged) {
    await prisma.radioPlayLog.create({
      data: {
        channelId,
        archiveItemId: item.id,
        title: item.title,
        artistName,
        artistUsername,
        artworkUrl: item.bannerUrl,
      },
    })
    await prisma.channel.update({
      where: { id: channelId },
      data: { totalPlays: { increment: 1 } },
    })
  }
}

/** STREAM-012: periodically resolves each running channel's current rotation
 * track (via Liquidsoap telnet metadata) to a real ArchiveItem, so the public
 * radio page can show accurate title/artist/artwork instead of generic branding
 * while nobody's actually live. A failure on any one channel never blocks the
 * others — each sync call is independently caught. */
export function startNowPlayingSync(): NodeJS.Timeout {
  return setInterval(() => {
    for (const [channelId, containerName] of getActiveChannelEntries()) {
      void syncChannelNowPlaying(channelId, containerName).catch((err) => {
        console.warn(
          `[orchestrator] now-playing sync failed for ${containerName}:`,
          err instanceof Error ? err.message : err,
        )
      })
    }
  }, NOW_PLAYING_POLL_INTERVAL_MS)
}
