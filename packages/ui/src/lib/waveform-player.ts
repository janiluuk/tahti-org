// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Waveform bar heights for animated player visualization (28 bars). */
export const WAVEFORM_BAR_HEIGHTS = [
  8, 14, 22, 30, 18, 26, 34, 20, 12, 28, 36, 24, 16, 30, 22, 18, 32, 14, 26, 20, 16, 28, 38, 22, 18,
  14, 26, 20,
] as const

export function formatPlayerTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
