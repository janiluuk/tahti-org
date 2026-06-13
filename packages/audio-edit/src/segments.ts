// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { EditCut, KeepSegment } from './types.js'

export function mergeCuts(cuts: EditCut[]): EditCut[] {
  if (cuts.length === 0) return []
  const sorted = [...cuts].sort((a, b) => a.start - b.start)
  const merged: EditCut[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = merged[merged.length - 1]!
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end)
    else merged.push({ ...cur })
  }
  return merged
}

export function computeKeepSegments(sourceDuration: number, cuts: EditCut[]): KeepSegment[] {
  const merged = mergeCuts(cuts)
  const segments: KeepSegment[] = []
  let cursor = 0
  for (const cut of merged) {
    const start = Math.max(0, Math.min(cut.start, sourceDuration))
    const end = Math.max(0, Math.min(cut.end, sourceDuration))
    if (start > cursor) segments.push({ start: cursor, end: start })
    cursor = Math.max(cursor, end)
  }
  if (cursor < sourceDuration) segments.push({ start: cursor, end: sourceDuration })
  if (segments.length === 0 && sourceDuration > 0 && merged.length === 0) {
    segments.push({ start: 0, end: sourceDuration })
  }
  return segments
}

export function postCutDuration(segments: KeepSegment[]): number {
  return segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0)
}

export function sourceTimeToPostCut(time: number, segments: KeepSegment[]): number | null {
  let offset = 0
  for (const seg of segments) {
    if (time >= seg.start && time < seg.end) return offset + (time - seg.start)
    offset += seg.end - seg.start
  }
  const last = segments[segments.length - 1]
  if (last && Math.abs(time - last.end) < 1e-6) return offset
  return null
}

export function postCutTimeToSource(time: number, segments: KeepSegment[]): number | null {
  let offset = 0
  for (const seg of segments) {
    const len = seg.end - seg.start
    if (time >= offset && time <= offset + len) return seg.start + (time - offset)
    offset += len
  }
  return null
}

export function isInsideCut(time: number, cuts: EditCut[]): boolean {
  return cuts.some((c) => time >= c.start && time < c.end)
}
