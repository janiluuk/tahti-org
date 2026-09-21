// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export const MAX_GENRES = 6

/** Toggles a genre, keeping selection order and the cap. */
export function toggleGenre(current: string[], genre: string): string[] {
  return current.includes(genre)
    ? current.filter((g) => g !== genre)
    : [...current, genre].slice(0, MAX_GENRES)
}
