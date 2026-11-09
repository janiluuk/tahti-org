// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Structured fields for correlating logs across ingest → orchestrator → worker (OPS-001). */
export type BroadcastSessionLogFields = {
  broadcastSessionId: string
  broadcastId: string
  channelId: string
  slug: string
  source?: string
}

export function broadcastSessionLogFields(opts: {
  broadcastId: string
  channelId: string
  slug: string
  source?: string
}): BroadcastSessionLogFields {
  return {
    broadcastSessionId: opts.broadcastId,
    broadcastId: opts.broadcastId,
    channelId: opts.channelId,
    slug: opts.slug,
    ...(opts.source ? { source: opts.source } : {}),
  }
}

/** How long a LIVE session stays open after the encoder drops, waiting for it to reconnect. */
export const BROADCAST_RECONNECT_GRACE_MS = 2 * 60 * 1000

export type IngestState = 'connected' | 'reconnecting' | 'disconnected'

/**
 * Encoder state for a channel. `channelState` alone can't answer this: the 24/7
 * fallback rotation keeps a channel LIVE with a placeholder broadcast that never
 * went live, and a dropped encoder keeps a real show LIVE during the grace period.
 */
export function ingestStateFor(
  channelState: string,
  openBroadcast: { wentLiveAt: Date | null; ingestDisconnectedAt: Date | null } | null | undefined,
): { ingest: IngestState; reconnectDeadline: Date | null } {
  if (channelState === 'OFFLINE' || !openBroadcast) {
    return { ingest: 'disconnected', reconnectDeadline: null }
  }
  if (openBroadcast.ingestDisconnectedAt) {
    return {
      ingest: 'reconnecting',
      reconnectDeadline: new Date(
        openBroadcast.ingestDisconnectedAt.getTime() + BROADCAST_RECONNECT_GRACE_MS,
      ),
    }
  }
  if (channelState === 'PREVIEW' || openBroadcast.wentLiveAt) {
    return { ingest: 'connected', reconnectDeadline: null }
  }
  return { ingest: 'disconnected', reconnectDeadline: null }
}
