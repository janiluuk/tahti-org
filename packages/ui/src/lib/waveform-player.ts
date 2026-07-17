// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Waveform bar heights for animated player visualization (28 bars, fits a 64px-tall row). */
export const WAVEFORM_BAR_HEIGHTS = [
  11, 19, 30, 40, 24, 35, 46, 27, 16, 38, 49, 32, 22, 40, 30, 24, 43, 19, 35, 27, 22, 38, 51, 30,
  24, 19, 35, 27,
] as const

export function formatPlayerTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
