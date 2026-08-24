// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readdir, stat } from 'node:fs/promises'
import { prisma } from '@tahti/db'
import { playbackKeyFromLocalCacheBasename, TAHTI_SELECTS_SLUG } from '@tahti/shared'
import {
  getActiveChannelEntries,
  spawnLiquidsoapContainer,
  stopLiquidsoapContainer,
} from './liquidsoap.js'
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

// --- Watchdog (STREAM-005's /restart endpoint existed but nothing ever called
// it — a channel could sit silently stuck indefinitely). Piggybacks on this
// same poll loop rather than a separate timer, since it already visits every
// active channel every tick. ---
const TELNET_FAILURE_THRESHOLD = 3 // ~60s of consecutive unresponsive polls
const HLS_STALE_MS = 20_000 // segments should land every 4s (segment_duration)
const RESTART_COOLDOWN_MS = 2 * 60_000
const HLS_ROOT = process.env.HLS_ROOT ?? '/hls'

const consecutiveTelnetFailures = new Map<string, number>()
const lastWatchdogRestartAt = new Map<string, number>()

/** True when this channel's newest HLS segment is older than HLS_STALE_MS.
 * Returns false (not stale) if the directory doesn't exist yet or has no
 * segments — a channel freshly spawned hasn't had time to produce any, and
 * that's not itself a failure signal. `hlsRoot` is overridable for tests. */
export async function hlsSegmentsAreStale(
  channelId: string,
  hlsRoot: string = HLS_ROOT,
): Promise<boolean> {
  const dir = `${hlsRoot}/${channelId}`
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return false
  }
  const segments = entries.filter((f) => f.endsWith('.ts'))
  if (segments.length === 0) return false

  let newestMtimeMs = 0
  for (const f of segments) {
    try {
      const s = await stat(`${dir}/${f}`)
      if (s.mtimeMs > newestMtimeMs) newestMtimeMs = s.mtimeMs
    } catch {
      // Segment could be mid-write/rotated out between readdir and stat — ignore.
    }
  }
  if (newestMtimeMs === 0) return false
  return Date.now() - newestMtimeMs > HLS_STALE_MS
}

/** Tear down and respawn a stuck channel's Liquidsoap process. Needs the
 * channel's active Broadcast row (source, id) to respawn correctly — if none
 * is found, this logs and bails rather than guessing, since spawning with the
 * wrong template/broadcastId could break a channel worse than leaving it stuck. */
async function watchdogRestart(channelId: string, containerName: string, reason: string) {
  const last = lastWatchdogRestartAt.get(channelId) ?? 0
  if (Date.now() - last < RESTART_COOLDOWN_MS) {
    console.warn(
      `[orchestrator] watchdog: ${containerName} looks stuck (${reason}) but was restarted ` +
        `less than ${RESTART_COOLDOWN_MS / 1000}s ago — skipping to avoid a restart loop`,
    )
    return
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { slug: true },
  })
  const broadcast = await prisma.broadcast.findFirst({
    where: { channelId, endedAt: null },
    orderBy: { startedAt: 'desc' },
    select: { id: true, source: true },
  })
  if (!channel || !broadcast) {
    console.warn(
      `[orchestrator] watchdog: ${containerName} looks stuck (${reason}) but no active ` +
        `Broadcast row was found for channel ${channelId} — cannot safely respawn, skipping`,
    )
    return
  }

  console.warn(
    `[orchestrator] watchdog: restarting ${containerName} (${reason}), broadcast ${broadcast.id}`,
  )
  lastWatchdogRestartAt.set(channelId, Date.now())
  consecutiveTelnetFailures.set(channelId, 0)

  try {
    await stopLiquidsoapContainer(channelId)
    await spawnLiquidsoapContainer(
      channelId,
      channel.slug,
      broadcast.id,
      broadcast.source,
      channel.slug === TAHTI_SELECTS_SLUG ? 'rotation' : 'channel',
    )
  } catch (err) {
    console.error(`[orchestrator] watchdog: failed to restart ${containerName}:`, err)
  }
}

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

/** @returns whether the telnet command reached the container — the watchdog
 * uses this to count consecutive failures, separately from whatever the
 * response actually contained. */
async function syncChannelNowPlaying(channelId: string, containerName: string): Promise<boolean> {
  let raw: string
  try {
    raw = await sendLiquidsoapTelnetCommand(containerName, LIQUIDSOAP_NOW_PLAYING_COMMAND)
  } catch {
    // Container not reachable this cycle (mid-restart, telnet not up yet, etc.) —
    // leave the last-known value in place and try again on the next tick.
    return false
  }

  const initialUri = parseLiquidsoapTelnetResponse(raw)
  if (!initialUri) return true

  const key = playbackKeyFromMetadata(initialUri)
  if (!key) return true

  const item = await prisma.archiveItem.findFirst({
    where: { OR: [{ mp3Key: key }, { flacKey: key }] },
    select: {
      id: true,
      title: true,
      artistName: true,
      bannerUrl: true,
      durationSec: true,
      channel: { select: { user: { select: { displayName: true, username: true } } } },
    },
  })
  if (!item) return true

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
      nowPlayingDurationSec: item.durationSec,
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
  return true
}

/** One channel's watchdog pass: counts consecutive telnet misses and checks
 * HLS segment freshness, restarting the channel if either trips. */
async function watchdogCheckChannel(channelId: string, containerName: string, telnetOk: boolean) {
  if (telnetOk) {
    consecutiveTelnetFailures.set(channelId, 0)
  } else {
    const failures = (consecutiveTelnetFailures.get(channelId) ?? 0) + 1
    consecutiveTelnetFailures.set(channelId, failures)
    if (failures >= TELNET_FAILURE_THRESHOLD) {
      await watchdogRestart(channelId, containerName, `${failures} consecutive telnet failures`)
      return
    }
  }

  if (await hlsSegmentsAreStale(channelId)) {
    await watchdogRestart(channelId, containerName, 'stale HLS segments')
  }
}

/** STREAM-012: periodically resolves each running channel's current rotation
 * track (via Liquidsoap telnet metadata) to a real ArchiveItem, so the public
 * radio page can show accurate title/artist/artwork instead of generic branding
 * while nobody's actually live. A failure on any one channel never blocks the
 * others — each sync call is independently caught.
 *
 * STREAM-005: also the watchdog — the same poll already visits every active
 * channel, so a stuck one (unresponsive telnet, or HLS segments that stopped
 * advancing) gets auto-restarted here instead of relying on someone noticing
 * dead air. */
export function startNowPlayingSync(): NodeJS.Timeout {
  return setInterval(() => {
    for (const [channelId, containerName] of getActiveChannelEntries()) {
      void syncChannelNowPlaying(channelId, containerName)
        .then((telnetOk) => watchdogCheckChannel(channelId, containerName, telnetOk))
        .catch((err) => {
          console.warn(
            `[orchestrator] now-playing sync failed for ${containerName}:`,
            err instanceof Error ? err.message : err,
          )
        })
    }
  }, NOW_PLAYING_POLL_INTERVAL_MS)
}
