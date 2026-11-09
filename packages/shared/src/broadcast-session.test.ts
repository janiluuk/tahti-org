// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  BROADCAST_RECONNECT_GRACE_MS,
  broadcastSessionLogFields,
  ingestStateFor,
} from './broadcast-session.js'

describe('broadcastSessionLogFields', () => {
  it('uses broadcastId as broadcastSessionId', () => {
    expect(
      broadcastSessionLogFields({
        broadcastId: 'bc_1',
        channelId: 'ch_1',
        slug: 'dj-test',
        source: 'RTMP',
      }),
    ).toEqual({
      broadcastSessionId: 'bc_1',
      broadcastId: 'bc_1',
      channelId: 'ch_1',
      slug: 'dj-test',
      source: 'RTMP',
    })
  })
})

describe('ingestStateFor', () => {
  const wentLiveAt = new Date('2026-11-10T20:00:00Z')

  it('is connected for a preview session and a live show with signal', () => {
    const open = { wentLiveAt: null, ingestDisconnectedAt: null }
    expect(ingestStateFor('PREVIEW', open).ingest).toBe('connected')
    expect(ingestStateFor('LIVE', { ...open, wentLiveAt }).ingest).toBe('connected')
  })

  it('is reconnecting with a deadline after the encoder drops mid-show', () => {
    const droppedAt = new Date('2026-11-10T21:00:00Z')
    expect(ingestStateFor('LIVE', { wentLiveAt, ingestDisconnectedAt: droppedAt })).toEqual({
      ingest: 'reconnecting',
      reconnectDeadline: new Date(droppedAt.getTime() + BROADCAST_RECONNECT_GRACE_MS),
    })
  })

  it('is disconnected offline and for the 24/7 fallback placeholder', () => {
    expect(ingestStateFor('OFFLINE', null).ingest).toBe('disconnected')
    expect(ingestStateFor('LIVE', { wentLiveAt: null, ingestDisconnectedAt: null }).ingest).toBe(
      'disconnected',
    )
  })
})
