// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { flagEmoji } from './flag-emoji'

export const COUNTRY_OPTIONS = [
  { code: 'FI', label: 'Finland' },
  { code: 'SE', label: 'Sweden' },
  { code: 'NO', label: 'Norway' },
  { code: 'DK', label: 'Denmark' },
  { code: 'EE', label: 'Estonia' },
  { code: 'DE', label: 'Germany' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'FR', label: 'France' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'PL', label: 'Poland' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
] as const

/** Country name for a code, falling back to the code itself if not in COUNTRY_OPTIONS. */
export function countryName(code: string | null | undefined): string {
  if (!code) return ''
  return COUNTRY_OPTIONS.find((c) => c.code === code.toUpperCase())?.label ?? code.toUpperCase()
}

/** "🇫🇮 Finland" — flag + name, for use in selects and display labels. */
export function countryFlagAndName(code: string | null | undefined): string {
  if (!code) return ''
  const name = countryName(code)
  return `${flagEmoji(code)} ${name}`.trim()
}
