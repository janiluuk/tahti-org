// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { DEFAULT_APP_URL } from './app-url'

/** Public status page URL (M11). Defaults to in-app `/status` until Upptime fork is live. */
export function statusPageUrl(): string {
  if (process.env.STATUS_PAGE_URL) return process.env.STATUS_PAGE_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? DEFAULT_APP_URL
  return `${appUrl.replace(/\/$/, '')}/status`
}
