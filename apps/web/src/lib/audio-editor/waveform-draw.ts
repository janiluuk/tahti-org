// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { EditCut, PeaksPyramid } from '@tahti/audio-edit'

export interface WaveformView {
  /** 0..1 visible start on source timeline */
  viewStart: number
  /** 0..1 visible end on source timeline */
  viewEnd: number
  playheadSec: number
  selection?: { start: number; end: number } | null
}

function pickLevel(pyramid: PeaksPyramid, pixelWidth: number): number[] {
  for (const level of pyramid.levels) {
    if (level.length >= pixelWidth * 0.5) return level
  }
  return pyramid.levels[pyramid.levels.length - 1] ?? []
}

export function drawWaveformLayer(
  ctx: CanvasRenderingContext2D,
  pyramid: PeaksPyramid,
  view: WaveformView,
  cuts: EditCut[],
): void {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  const peaks = pickLevel(pyramid, width)
  const startFrac = view.viewStart
  const endFrac = view.viewEnd
  const span = Math.max(0.001, endFrac - startFrac)
  const startIdx = Math.floor(startFrac * peaks.length)
  const endIdx = Math.ceil(endFrac * peaks.length)
  const slice = peaks.slice(startIdx, endIdx)
  const mid = height / 2

  ctx.fillStyle = 'rgba(148, 163, 184, 0.2)'
  for (const cut of cuts) {
    const c0 = (cut.start / pyramid.durationSec - startFrac) / span
    const c1 = (cut.end / pyramid.durationSec - startFrac) / span
    if (c1 < 0 || c0 > 1) continue
    ctx.fillRect(Math.max(0, c0 * width), 0, (Math.min(1, c1) - Math.max(0, c0)) * width, height)
  }

  const sel = view.selection
  const selStart = sel ? (sel.start / pyramid.durationSec - startFrac) / span : null
  const selEnd = sel ? (sel.end / pyramid.durationSec - startFrac) / span : null

  slice.forEach((peak, i) => {
    const x = (i / slice.length) * width
    const barH = (peak / 255) * (height * 0.85)
    const frac = i / slice.length
    const inSelection = selStart !== null && selEnd !== null && frac >= selStart && frac <= selEnd
    ctx.fillStyle = inSelection ? 'rgba(126, 231, 238, 0.85)' : 'rgba(34, 211, 238, 0.55)'
    ctx.fillRect(x, mid - barH / 2, Math.max(1, width / slice.length), barH)
  })

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, mid)
  ctx.lineTo(width, mid)
  ctx.stroke()
}

export function drawMinimapLayer(ctx: CanvasRenderingContext2D, pyramid: PeaksPyramid): void {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  const peaks = pyramid.levels[pyramid.levels.length - 1] ?? []
  const mid = height / 2
  ctx.fillStyle = 'rgba(34, 211, 238, 0.4)'
  peaks.forEach((peak, i) => {
    const x = (i / peaks.length) * width
    const barH = (peak / 255) * (height * 0.9)
    ctx.fillRect(x, mid - barH / 2, Math.max(1, width / peaks.length), barH)
  })
}

export function drawOverlayLayer(
  ctx: CanvasRenderingContext2D,
  pyramid: PeaksPyramid,
  view: WaveformView,
): void {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  const span = Math.max(0.001, view.viewEnd - view.viewStart)

  if (view.selection) {
    const s0 = (view.selection.start / pyramid.durationSec - view.viewStart) / span
    const s1 = (view.selection.end / pyramid.durationSec - view.viewStart) / span
    if (s1 > 0 && s0 < 1) {
      const x = Math.max(0, s0) * width
      const w = (Math.min(1, s1) - Math.max(0, s0)) * width
      ctx.fillStyle = 'rgba(34, 211, 238, 0.08)'
      ctx.fillRect(x, 0, w, height)
      ctx.strokeStyle = 'rgba(34, 211, 238, 1)'
      ctx.lineWidth = 2
      ctx.strokeRect(x, 0, w, height)
    }
  }

  const ph = (view.playheadSec / pyramid.durationSec - view.viewStart) / span
  if (ph >= 0 && ph <= 1) {
    const x = ph * width
    ctx.strokeStyle = 'rgba(251, 191, 36, 1)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - 6, 0)
    ctx.lineTo(x + 6, 0)
    ctx.lineTo(x, 8)
    ctx.closePath()
    ctx.fillStyle = 'rgba(251, 191, 36, 1)'
    ctx.fill()
  }
}
