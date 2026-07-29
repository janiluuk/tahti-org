// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export interface SlideshowTransitionProps {
  fromUrl: string
  toUrl: string
  durationMs: number
  /** Called exactly once, when the transition finishes animating. */
  onComplete: () => void
}
