// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createClient, type RedisClientType } from 'redis'
import { config } from '../config.js'

let client: RedisClientType | null = null
let connectPromise: Promise<RedisClientType | null> | null = null

/** Shared Redis client (PLAT-011). Returns null in test env or when connect fails. */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (config.nodeEnv === 'test') return null
  if (client?.isOpen) return client
  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const c = createClient({ url: config.redisUrl })
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

export async function closeRedisClient(): Promise<void> {
  if (client?.isOpen) await client.quit().catch(() => undefined)
  client = null
  connectPromise = null
}
