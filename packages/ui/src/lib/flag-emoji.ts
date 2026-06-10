// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** ISO 3166-1 alpha-2 → flag emoji. */
export function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return ''
  return [...countryCode.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}
