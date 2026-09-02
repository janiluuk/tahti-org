// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Canonical cover / avatar placeholder gradients (v8). */
export type CoverGradient = 'aurora' | 'coral' | 'deep' | 'amber' | 'violet'

export const COVER_GRADIENTS: CoverGradient[] = ['aurora', 'coral', 'deep', 'amber', 'violet']

/** Deterministic gradient from a release or user id — same id always maps to the same gradient. */
export function coverGradientFromId(id: string): CoverGradient {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length]!
}

/** Randomly-chosen gradient — for placeholder covers where a fresh, varied look matters more
 * than the same row always landing on the same preset (see coverGradientFromId for that case). */
export function randomCoverGradient(): CoverGradient {
  return COVER_GRADIENTS[Math.floor(Math.random() * COVER_GRADIENTS.length)]!
}
