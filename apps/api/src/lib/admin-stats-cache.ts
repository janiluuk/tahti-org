// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'

const entries = new Map<string, { value: unknown; at: number }>()
const inFlight = new Map<string, Promise<unknown>>()

/** Reuses `compute`'s result under `key` for `ttlSec` in this API process,
 * and lets concurrent misses share one computation. In memory rather than
 * Redis: callers must keep answering while a stalled Redis is being bypassed,
 * and per-replica reuse is enough for these aggregates. */
export async function cachedInProcess<T>(
  key: string,
  ttlSec: number,
  compute: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const ttlMs = ttlSec * 1000
  const hit = entries.get(key)
  if (ttlMs > 0 && hit && now() - hit.at < ttlMs) return hit.value as T

  const current = inFlight.get(key) as Promise<T> | undefined
  if (current) return current

  const pending = compute().then((value) => {
    if (ttlMs > 0) entries.set(key, { value, at: now() })
    return value
  })
  inFlight.set(key, pending)
  try {
    return await pending
  } finally {
    inFlight.delete(key)
  }
}

/** Reuses an admin dashboard panel's result for `config.adminStatsCacheSec`
 * (see `cachedInProcess`). */
export function cachedAdminStat<T>(
  panel: string,
  compute: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  return cachedInProcess(`admin:${panel}`, config.adminStatsCacheSec, compute, now)
}

/** Drops every cached entry so the next request recomputes it. */
export function clearAdminStatsCache(): void {
  entries.clear()
}
