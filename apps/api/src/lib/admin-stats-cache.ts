// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

const entries = new Map<string, { value: unknown; at: number }>()
const inFlight = new Map<string, Promise<unknown>>()

/** Reuses an admin dashboard panel's result for `config.adminStatsCacheSec`
 * in this API process, and lets concurrent misses share one computation. In
 * memory rather than Redis: queue stats already read Redis, and the panels
 * must keep loading while a stalled Redis is being bypassed. */
export async function cachedAdminStat<T>(
  panel: string,
  compute: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const ttlMs = config.adminStatsCacheSec * 1000
  const hit = entries.get(panel)
  if (ttlMs > 0 && hit && now() - hit.at < ttlMs) return hit.value as T

  const current = inFlight.get(panel) as Promise<T> | undefined
  if (current) return current

  const pending = compute().then((value) => {
    if (ttlMs > 0) entries.set(panel, { value, at: now() })
    return value
  })
  inFlight.set(panel, pending)
  try {
    return await pending
  } finally {
    inFlight.delete(panel)
  }
}

/** Drops cached panels so the next request recomputes them. */
export function clearAdminStatsCache(): void {
  entries.clear()
}
