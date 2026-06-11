// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Production app origin — never localhost in user-facing fallbacks. */
export const DEFAULT_APP_URL = 'https://app.tahti.live'

export function resolveAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? DEFAULT_APP_URL
  return raw.replace(/\/$/, '')
}
