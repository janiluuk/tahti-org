// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** First letters of up to two words, or first two chars of a single token. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  }
  if (parts.length === 1) {
    const word = parts[0]!
    return word.length >= 2 ? word.slice(0, 2).toUpperCase() : word.toUpperCase()
  }
  return '?'
}
