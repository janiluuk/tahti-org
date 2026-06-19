// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { parseVideoEmbedUrl } from './video-embed.js'

/** Characters that must not appear in values passed to CSS `url()`. */
// eslint-disable-next-line no-control-regex -- intentional ASCII control-char blocklist
const CSS_URL_UNSAFE = /[\x00-\x1f"'()\\;]/

/**
 * Allowed backdrop sources: HTTPS image URLs or YouTube/Vimeo watch links.
 * Rejects `javascript:`, `data:`, and CSS-breakout payloads.
 */
export function isAllowedBackdropUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed || trimmed.length > 2048) return false
  if (CSS_URL_UNSAFE.test(trimmed)) return false
  if (parseVideoEmbedUrl(trimmed)) return true
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** Safe CSS `url("…")` value for custom properties (defense in depth at render time). */
export function cssBackdropUrlValue(url: string): string | null {
  if (!isAllowedBackdropUrl(url)) return null
  const escaped = url.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `url("${escaped}")`
}
