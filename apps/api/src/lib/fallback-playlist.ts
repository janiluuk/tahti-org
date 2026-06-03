// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { archivePlaybackKey } from '@tahti/shared'
import type { FallbackMode } from '@tahti/shared'

export type FallbackSourceRow = {
  id: string
  title: string
  mp3Key: string | null
  flacKey: string | null
  durationSec: number | null
  isFallback: boolean
  fallbackOrder: number | null
  lastFallbackPlayedAt: Date | null
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
