// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { getRedisClient } from './redis.js'

// Coalesce concurrent misses in this API process. Redis prevents repeated work
// across requests after the first value is written, while this map prevents a
// hot key expiry from making every request perform the same database work.
const inFlight = new Map<string, Promise<unknown>>()

/**
 * Short-TTL Redis cache for JSON-serializable responses on public hot paths.
 * Falls back to calling `compute` directly when Redis is unavailable.
 */
export async function getCachedJson<T>(
  key: string,
  ttlSec: number,
  compute: () => Promise<T>,
): Promise<T> {
  const redis = await getRedisClient()
  if (!redis) return compute()

  try {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as T
  } catch {
    // fall through to compute on cache read errors
  }

  const current = inFlight.get(key) as Promise<T> | undefined
  if (current) return current

  const pending = (async () => {
    const value = await compute()
    try {
      await redis.set(key, JSON.stringify(value), { EX: ttlSec })
    } catch {
      // ignore cache write errors
    }
    return value
  })()
  inFlight.set(key, pending)

  try {
    return await pending
  } finally {
    if (inFlight.get(key) === pending) inFlight.delete(key)
  }
}

/** Evicts a single cached key ahead of its TTL — for the rare case where a
 * write must be reflected immediately (e.g. session invalidation on logout)
 * rather than waiting out a short cache window. No-op if Redis is down. */
export async function invalidateCachedJson(key: string): Promise<void> {
  const redis = await getRedisClient()
  if (!redis) return
  try {
    await redis.del(key)
  } catch {
    // best-effort — a failed delete just means the TTL runs its course
  }
}
