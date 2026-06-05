// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  IcecastConnectSchema,
  IcecastDisconnectSchema,
  IngestForbiddenTextSchema,
  IngestInvalidTextSchema,
  IngestOkTextSchema,
  ItemReadyWebhookSchema,
  RtmpPublishAllowTextSchema,
  RtmpWebhookBodySchema,
} from './ingest.js'

describe('ingest DTOs (PLAT-014)', () => {
  it('parses RTMP webhook body', () => {
    expect(RtmpWebhookBodySchema.safeParse({ name: 'artist__key' }).success).toBe(true)
    expect(RtmpWebhookBodySchema.safeParse({}).success).toBe(false)
  })

  it('parses Icecast connect/disconnect', () => {
    expect(IcecastConnectSchema.safeParse({ mount: '/live/x', pass: 'secret' }).success).toBe(true)
    expect(IcecastDisconnectSchema.safeParse({ mount: '/live/x' }).success).toBe(true)
  })

  it('parses item-ready webhook', () => {
    expect(ItemReadyWebhookSchema.safeParse({ itemId: 'item_1' }).success).toBe(true)
    expect(ItemReadyWebhookSchema.safeParse({ itemId: '' }).success).toBe(false)
  })

  it('parses plain-text ingest responses', () => {
    expect(IngestOkTextSchema.safeParse('ok').success).toBe(true)
    expect(RtmpPublishAllowTextSchema.safeParse('allowed').success).toBe(true)
    expect(IngestForbiddenTextSchema.safeParse('denied').success).toBe(true)
    expect(IngestForbiddenTextSchema.safeParse('weekly_cap').success).toBe(true)
    expect(IngestInvalidTextSchema.safeParse('invalid').success).toBe(true)
  })
})
