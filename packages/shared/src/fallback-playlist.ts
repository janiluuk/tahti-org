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

export function renderFallbackM3u(
  rows: FallbackPlaybackRow[],
  publicEndpoint: string,
  bucket: string,
): string {
  if (rows.length === 0) {
    return '#EXTM3U\n# no items yet\n'
  }
  const lines: string[] = ['#EXTM3U']
  for (const row of rows) {
    const duration = row.durationSec ?? -1
    lines.push(`#EXTINF:${duration},${row.title}`)
    lines.push(`${publicEndpoint}/${bucket}/${row.playbackKey}`)
  }
  return lines.join('\n') + '\n'
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
