// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export interface SpinnerProps {
  /** @default 'md' */
  size?: 'sm' | 'md'
  className?: string
}

/** Shared loading spinner for any playable surface (track rows, queue items,
 * player transport buttons) waiting on audio to start — one visual instead
 * of the per-surface copies this replaced (WaveformPlayer's and the
 * mini-player's own near-identical spinner CSS). */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={`ui-spinner ui-spinner--${size}${className ? ` ${className}` : ''}`}
      aria-hidden
    />
  )
}
