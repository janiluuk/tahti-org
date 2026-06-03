// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

/** Per-fingerprint/IP download rate limits (M18), tunable via env. */
export function downloadRateLimits(): { perHour: number; perDay: number } {
  return {
    perHour: config.download.ratePerHour,
    perDay: config.download.ratePerDay,
  }
}
