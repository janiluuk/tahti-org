// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { hashPassword } from './password.js'
import {
  HOT_INGEST_ROTATE_GRACE_MS,
  hotRotatePreviousFields,
  verifyRtmpStreamName,
} from './ingest-credentials.js'

describe('ingest-credentials hot rotation', () => {
  it('accepts current stream name', async () => {
    const key = 'artist__abc123'
    const hash = await hashPassword(key)
    expect(
      await verifyRtmpStreamName(hash, { previousHash: null, previousExpiresAt: null }, key),
    ).toBe(true)
  })

  it('accepts previous stream name within grace window', async () => {
    const oldKey = 'artist__oldkey'
    const newKey = 'artist__newkey'
    const oldHash = await hashPassword(oldKey)
    const newHash = await hashPassword(newKey)
    const prev = hotRotatePreviousFields(oldHash)

    expect(await verifyRtmpStreamName(newHash, prev, oldKey)).toBe(true)
    expect(await verifyRtmpStreamName(newHash, prev, newKey)).toBe(true)
  })

  it('rejects expired previous stream name', async () => {
    const oldKey = 'artist__oldkey'
    const newHash = await hashPassword('artist__newkey')
    expect(
      await verifyRtmpStreamName(
        newHash,
        {
          previousHash: await hashPassword(oldKey),
          previousExpiresAt: new Date(Date.now() - 1000),
        },
        oldKey,
      ),
    ).toBe(false)
  })

  it('grace window is 24 hours', () => {
    expect(HOT_INGEST_ROTATE_GRACE_MS).toBe(86_400_000)
  })
})
