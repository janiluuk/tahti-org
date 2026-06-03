// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** PLAT-006: result when Redis is unavailable for token-bucket checks. */
export function rateLimitWhenRedisUnavailable(
  failOpen: boolean,
  windowSec: number,
): { ok: boolean; remaining: number; resetSec: number } {
  return {
    ok: failOpen,
    remaining: failOpen ? 999 : 0,
    resetSec: windowSec,
  }
}
