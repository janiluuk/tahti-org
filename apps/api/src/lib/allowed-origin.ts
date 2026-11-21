// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

/** Web origins the API trusts: CORS with credentials, and OAuth sign-in redirect targets. */
export function isAllowedOrigin(origin: string): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }

  if (origin === config.appUrl) return true

  if (['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'].includes(origin)) {
    return true
  }

  if (
    url.protocol === 'https:' &&
    (url.hostname === 'tahti.live' || url.hostname.endsWith('.tahti.live'))
  ) {
    return true
  }

  // Local/dev/e2e stacks publish web and api on different localhost ports —
  // those are cross-origin too, so allow them outside production.
  if (!config.isProd && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    return true
  }

  return false
}
