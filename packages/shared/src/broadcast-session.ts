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
