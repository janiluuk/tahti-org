// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createClient, TimeoutError, type RedisClientType } from 'redis'
import { config } from '../config.js'

let client: RedisClientType | null = null
let connectPromise: Promise<RedisClientType | null> | null = null
let bypassUntil = 0

/** Shared Redis client (PLAT-011). Returns null in test env or when connect fails. */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (config.nodeEnv === 'test') return null
  if (client?.isOpen) return client
  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const c: RedisClientType = createClient({
          url: config.redisUrl,
          commandOptions: { timeout: config.redisCommandTimeoutMs },
        })
        c.on('error', (err) => {
          console.error('[redis]', err)
        })
        await c.connect()
        client = c
        return client
      } catch (err) {
        console.error('[redis] connect failed:', err)
        connectPromise = null
        return null
      }
    })()
  }
  return connectPromise
}

/**
 * Shared client for optional Redis use (response cache, rate limiting), where
 * skipping Redis is always safe. Returns null for a short window after a
 * command timed out, so requests don't each wait out the timeout while Redis
 * is stalled.
 */
export async function getOptionalRedisClient(): Promise<RedisClientType | null> {
  if (Date.now() < bypassUntil) return null
  return getRedisClient()
}

/** Reports a failed optional-path command; timeouts start the bypass window. */
export function noteRedisFailure(err: unknown): void {
  if (!(err instanceof TimeoutError)) return
  const now = Date.now()
  if (now >= bypassUntil) {
    console.warn(
      `[redis] command timed out; bypassing optional Redis use for ${config.redisSlowBypassMs}ms`,
    )
  }
  bypassUntil = now + config.redisSlowBypassMs
}

export async function closeRedisClient(): Promise<void> {
  if (client?.isOpen) await client.quit().catch(() => undefined)
  client = null
  connectPromise = null
  bypassUntil = 0
}
