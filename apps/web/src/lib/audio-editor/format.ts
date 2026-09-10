// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Pure display helpers for the pro audio editor (extracted from
// app/dashboard/pro-audio-editor.tsx so they can be unit-tested without
// mounting the editor).

export function formatRelativeSave(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000)
  if (sec < 12) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  return new Date(ts).toLocaleTimeString()
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatDurationDecimal(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}
