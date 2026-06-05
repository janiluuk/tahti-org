// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { config } from '../config.js'
import { enrichFingerprintSegmentFromAcrcloud } from './fingerprint-segment-enrich.js'

vi.mock('../config.js', () => ({
  config: {
    acrcloud: {
      enabled: true,
      host: 'identify-eu-west-1.acrcloud.com',
      accessKey: 'test-key',
      accessSecret: 'test-secret',
    },
  },
}))

describe('enrichFingerprintSegmentFromAcrcloud', () => {
  beforeEach(() => {
    config.acrcloud.enabled = true
    vi.restoreAllMocks()
  })

  it('returns segment unchanged without audio sample', async () => {
    const seg = { offsetSec: 0, durationSec: 12, fingerprint: 'AQAA_test' }
    await expect(enrichFingerprintSegmentFromAcrcloud(seg)).resolves.toEqual(seg)
  })

  it('returns segment unchanged when ACRCloud is disabled', async () => {
    config.acrcloud.enabled = false

    const seg = { offsetSec: 0, durationSec: 12, fingerprint: 'AQAA_test' }
    await expect(
      enrichFingerprintSegmentFromAcrcloud(seg, Buffer.from('fake-mp3').toString('base64')),
    ).resolves.toEqual(seg)
  })

  it('adds title from ACRCloud match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: { code: 0 },
          metadata: {
            music: [{ title: 'Track X', artists: [{ name: 'Artist Y' }], score: 90 }],
          },
        }),
      }),
    )

    const enriched = await enrichFingerprintSegmentFromAcrcloud(
      { offsetSec: 30, durationSec: 12, fingerprint: 'AQAA_x' },
      Buffer.from('fake-mp3').toString('base64'),
    )

    expect(enriched).toMatchObject({
      title: 'Track X',
      artist: 'Artist Y',
      identifySource: 'acrcloud',
    })
  })
})
