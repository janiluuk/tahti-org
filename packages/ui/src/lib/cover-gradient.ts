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
