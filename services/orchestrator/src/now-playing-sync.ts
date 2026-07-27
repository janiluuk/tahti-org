// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { prisma } from '@tahti/db'
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
 * `annotate:key="val",...:URL` prefix for entries with inline metadata (our
 * fallback M3U sets title/duration this way) — confirmed by dumping every
 * metadata key against a real production track rather than guessing. Extract
 * just the http(s) URL portion. */
export function trackUrlFromMetadata(initialUri: string): string | null {
  const match = initialUri.match(/https?:\/\/\S+$/)
  return match ? match[0] : null
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

  const trackUrl = trackUrlFromMetadata(initialUri)
  if (!trackUrl) return

  const key = objectKeyFromUrl(trackUrl)
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
      void syncChannelNowPlaying(channelId, containerName)
    }
  }, NOW_PLAYING_POLL_INTERVAL_MS)
}
