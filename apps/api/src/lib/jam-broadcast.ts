// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { RedisClientType } from 'redis'
import type { JamEvent } from '@tahti/shared'
import { getRedisClient } from './redis.js'

const CHANNEL_PREFIX = 'jam:'

/** Local (this-process) listeners, keyed by session id — what actually
 * drives each open SSE connection's `reply.raw.write`. */
const sessionListeners = new Map<string, Set<(event: JamEvent) => void>>()

/** Dedicated subscriber connection. node-redis requires SUBSCRIBE to run on
 * a connection that isn't used for ordinary commands, so this is a
 * `duplicate()` of the shared client from getRedisClient() rather than that
 * client itself. Lazily created on first subscribe, reused after. */
let subscriber: RedisClientType | null = null
let subscriberConnectPromise: Promise<RedisClientType | null> | null = null
const redisSubscribedSessions = new Set<string>()

async function getSubscriber(): Promise<RedisClientType | null> {
  const base = await getRedisClient()
  // No Redis (test env — see getRedisClient — or a real outage): callers
  // fall back to this-process-only fan-out below. A single-process
  // deployment still works correctly either way.
  if (!base) return null
  if (subscriber?.isOpen) return subscriber
  if (!subscriberConnectPromise) {
    subscriberConnectPromise = (async () => {
      try {
        const dup = base.duplicate() as RedisClientType
        dup.on('error', (err) => console.error('[jam-broadcast]', err))
        await dup.connect()
        subscriber = dup
        return subscriber
      } catch (err) {
        console.error('[jam-broadcast] subscriber connect failed:', err)
        subscriberConnectPromise = null
        return null
      }
    })()
  }
  return subscriberConnectPromise
}

/** Subscribes `listener` to a Jam session's events. When Redis is available,
 * every event — including ones published from this same process — is
 * delivered via the Redis subscription, so there's exactly one delivery
 * path and no risk of double-firing a listener; when it isn't (test env),
 * falls back to direct in-process dispatch from publishToJam below. Returns
 * an unsubscribe function. */
export async function subscribeToJam(
  sessionId: string,
  listener: (event: JamEvent) => void,
): Promise<() => void> {
  let listeners = sessionListeners.get(sessionId)
  if (!listeners) {
    listeners = new Set()
    sessionListeners.set(sessionId, listeners)
  }
  listeners.add(listener)

  const sub = await getSubscriber()
  if (sub && !redisSubscribedSessions.has(sessionId)) {
    redisSubscribedSessions.add(sessionId)
    await sub.subscribe(CHANNEL_PREFIX + sessionId, (message) => {
      const current = sessionListeners.get(sessionId)
      if (!current) return
      let event: JamEvent
      try {
        event = JSON.parse(message) as JamEvent
      } catch {
        return
      }
      for (const l of current) l(event)
    })
  }

  return () => {
    listeners!.delete(listener)
    if (listeners!.size === 0) {
      sessionListeners.delete(sessionId)
      if (sub && redisSubscribedSessions.has(sessionId)) {
        redisSubscribedSessions.delete(sessionId)
        void sub.unsubscribe(CHANNEL_PREFIX + sessionId).catch(() => undefined)
      }
    }
  }
}

export async function publishToJam(sessionId: string, event: JamEvent): Promise<void> {
  const redis = await getRedisClient()
  if (redis) {
    await redis.publish(CHANNEL_PREFIX + sessionId, JSON.stringify(event))
    return
  }
  // No Redis — direct in-process fan-out (matches subscribeToJam's fallback).
  const listeners = sessionListeners.get(sessionId)
  if (!listeners) return
  for (const listener of listeners) listener(event)
}
