// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { archivePlaybackKey } from './archive-playback.js'
import type { FallbackMode } from './dto/channel-programme.js'

export type FallbackSourceRow = {
  id: string
  title: string
  mp3Key: string | null
  flacKey: string | null
  durationSec: number | null
  isFallback: boolean
  fallbackOrder: number | null
  lastFallbackPlayedAt: Date | null
  createdAt: Date
}

export type FallbackPlaybackRow = {
  id: string
  title: string
  playbackKey: string
  durationSec: number | null
}

/** Items eligible for 24/7 offline rotation (M27). */
export function selectFallbackPool(items: FallbackSourceRow[]): FallbackSourceRow[] {
  const withPlayback = items.filter((i) => archivePlaybackKey(i))
  if (withPlayback.length === 0) return []
  const flagged = withPlayback.filter((i) => i.isFallback)
  return flagged.length > 0 ? flagged : withPlayback
}

export function orderFallbackPool(
  items: FallbackSourceRow[],
  fallbackMode: string,
): FallbackSourceRow[] {
  const pool = selectFallbackPool(items)
  if (pool.length === 0) return []

  if (fallbackMode === 'ordered') {
    return [...pool].sort((a, b) => {
      const ao = a.fallbackOrder ?? Number.MAX_SAFE_INTEGER
      const bo = b.fallbackOrder ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      return a.id.localeCompare(b.id)
    })
  }

  if (fallbackMode === 'name') {
    return [...pool].sort((a, b) => a.title.localeCompare(b.title))
  }

  if (fallbackMode === 'time') {
    return [...pool].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  // shuffle: fair rotation — longest since last play first
  return [...pool].sort((a, b) => {
    const at = a.lastFallbackPlayedAt?.getTime() ?? 0
    const bt = b.lastFallbackPlayedAt?.getTime() ?? 0
    if (at !== bt) return at - bt
    return a.id.localeCompare(b.id)
  })
}

export function buildFallbackPlaybackRows(
  items: FallbackSourceRow[],
  fallbackMode: FallbackMode | string,
): FallbackPlaybackRow[] {
  const ordered = orderFallbackPool(items, fallbackMode)
  const rows: FallbackPlaybackRow[] = []
  for (const item of ordered) {
    const playbackKey = archivePlaybackKey(item)
    if (!playbackKey) continue
    rows.push({
      id: item.id,
      title: item.title,
      playbackKey,
      durationSec: item.durationSec,
    })
  }
  return rows
}

export type FallbackM3uEntry = {
  title: string
  durationSec: number | null
  url: string
}

// The tahti/mp3 prefix is not publicly readable (unlike covers/avatars/archive
// banners — mp3/flac audio may be gated catalog content), so each entry's URL is
// caller-supplied (a presigned GET) rather than built from a public endpoint here.
export function renderFallbackM3u(entries: FallbackM3uEntry[]): string {
  if (entries.length === 0) {
    return '#EXTM3U\n# no items yet\n'
  }
  const lines: string[] = ['#EXTM3U']
  for (const entry of entries) {
    const duration = entry.durationSec ?? -1
    lines.push(`#EXTINF:${duration},${entry.title}`)
    lines.push(entry.url)
  }
  return lines.join('\n') + '\n'
}

export type AnnouncementScheduleMode = 'AFTER_EVERY' | 'EVERY_NTH' | 'RANDOM'

export type AnnouncementPlaybackRow = FallbackPlaybackRow & {
  scheduleMode: AnnouncementScheduleMode
  everyNth: number | null
}

/** Roughly 1 in this many track boundaries gets a RANDOM-mode clip — a fixed
 * probability rather than a fixed count, so short and long rotations both get
 * a reasonable, unobtrusive sprinkling instead of none or too many. */
const RANDOM_ANNOUNCEMENT_CHANCE = 1 / 15

/** Splices announcement clips into an already-ordered track list. System
 * clips (with a configured schedule) and a channel's own clips (always
 * RANDOM-spaced, no configurable schedule) are independent — both can fire
 * at the same boundary. No system clips at all is a no-op for that half,
 * regardless of whether the channel has its own clips enabled. */
export function interleaveAnnouncements(
  rows: FallbackPlaybackRow[],
  systemAnnouncements: AnnouncementPlaybackRow[],
  ownAnnouncements: FallbackPlaybackRow[],
): FallbackPlaybackRow[] {
  if (rows.length === 0) return rows
  if (systemAnnouncements.length === 0 && ownAnnouncements.length === 0) return rows

  const afterEvery = systemAnnouncements.filter((a) => a.scheduleMode === 'AFTER_EVERY')
  const everyNth = systemAnnouncements.filter(
    (a) => a.scheduleMode === 'EVERY_NTH' && a.everyNth != null && a.everyNth > 0,
  )
  const random = systemAnnouncements.filter((a) => a.scheduleMode === 'RANDOM')

  let afterEveryIdx = 0
  let randomIdx = 0
  let ownIdx = 0
  const out: FallbackPlaybackRow[] = []

  for (let i = 0; i < rows.length; i++) {
    out.push(rows[i]!)
    const position = i + 1 // 1-based count of tracks played so far, for "every Nth"

    if (afterEvery.length > 0) {
      out.push(afterEvery[afterEveryIdx % afterEvery.length]!)
      afterEveryIdx++
    }

    for (const clip of everyNth) {
      if (position % clip.everyNth! === 0) out.push(clip)
    }

    if (random.length > 0 && Math.random() < RANDOM_ANNOUNCEMENT_CHANCE) {
      out.push(random[randomIdx % random.length]!)
      randomIdx++
    }

    if (ownAnnouncements.length > 0 && Math.random() < RANDOM_ANNOUNCEMENT_CHANCE) {
      out.push(ownAnnouncements[ownIdx % ownAnnouncements.length]!)
      ownIdx++
    }
  }

  return out
}

/** Safe filename for a MinIO playback key under a channel cache directory (STREAM-009). */
export function localCacheBasename(playbackKey: string): string {
  return playbackKey.replace(/\//g, '__')
}

export function channelArchiveCacheDir(cacheRoot: string, channelId: string): string {
  return `${cacheRoot.replace(/\/$/, '')}/${channelId}`
}

/** M3U with absolute paths for Liquidsoap local playlist reload. */
export function renderLocalFallbackM3u(
  rows: FallbackPlaybackRow[],
  channelCacheDir: string,
): string {
  if (rows.length === 0) {
    return '#EXTM3U\n# no items yet\n'
  }
  const dir = channelCacheDir.replace(/\/$/, '')
  const lines: string[] = ['#EXTM3U']
  for (const row of rows) {
    const duration = row.durationSec ?? -1
    lines.push(`#EXTINF:${duration},${row.title}`)
    lines.push(`${dir}/${localCacheBasename(row.playbackKey)}`)
  }
  return lines.join('\n') + '\n'
}
