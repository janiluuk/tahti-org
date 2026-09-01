// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { JamEvent } from '@tahti/shared'

/** In-process pub/sub for the Jam SSE stream. Fan-out only reaches
 * connections held by this one API process — fine for a single instance,
 * but if @tahti/api ever runs more than one process/pod behind a load
 * balancer, a participant connected to a different instance than the one
 * handling the host's state push won't see updates. Needs a Redis (or
 * similar) pub/sub adapter before that's true; tracked as a known v1 gap,
 * not solved here. */
const sessionListeners = new Map<string, Set<(event: JamEvent) => void>>()

export function subscribeToJam(sessionId: string, listener: (event: JamEvent) => void): () => void {
  let listeners = sessionListeners.get(sessionId)
  if (!listeners) {
    listeners = new Set()
    sessionListeners.set(sessionId, listeners)
  }
  listeners.add(listener)

  return () => {
    listeners!.delete(listener)
    if (listeners!.size === 0) {
      sessionListeners.delete(sessionId)
    }
  }
}

export function publishToJam(sessionId: string, event: JamEvent): void {
  const listeners = sessionListeners.get(sessionId)
  if (!listeners) return
  for (const listener of listeners) listener(event)
}
