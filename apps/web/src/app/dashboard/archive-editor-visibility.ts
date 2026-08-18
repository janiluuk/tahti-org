// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const LONG_FORM_DURATION_SEC = 20 * 60
const SHOW_CONTENT_TYPES = new Set(['DJ_MIX', 'LIVE', 'RADIO_SHOW', 'PODCAST'])

export function shouldShowTracklist(contentType: string, durationSec?: number | null): boolean {
  return contentType === 'DJ_MIX' || (durationSec ?? 0) >= LONG_FORM_DURATION_SEC
}

export function shouldShowVenueLocation(contentType: string, source?: string | null): boolean {
  return source === 'BROADCAST' || SHOW_CONTENT_TYPES.has(contentType)
}
