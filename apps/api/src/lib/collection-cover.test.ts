// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { resolveCollectionCoverUrl } from './collection-cover.js'
import { config } from '../config.js'

describe('resolveCollectionCoverUrl', () => {
  it('presigns when coverKey is set, ignoring coverUrl', async () => {
    const url = await resolveCollectionCoverUrl({
      coverUrl: 'https://stale.example.com/old.jpg',
      coverKey: 'collections/artist/slug/cover-abc.jpg',
    })
    expect(url).toContain('collections/artist/slug/cover-abc.jpg')
    expect(url).not.toBe('https://stale.example.com/old.jpg')
  })

  it('derives the key from a legacy coverUrl pointing at our own bucket', async () => {
    const legacyUrl = `${config.minio.publicEndpoint}/${config.minio.bucket}/collections/artist/slug/cover-legacy.jpg`
    const url = await resolveCollectionCoverUrl({ coverUrl: legacyUrl, coverKey: null })
    expect(url).toContain('collections/artist/slug/cover-legacy.jpg')
    // A presigned URL always carries query-string auth params — confirms this went
    // through presignedGetUrl rather than returning the legacy URL unchanged.
    expect(url).not.toBe(legacyUrl)
  })

  it('passes through an external URL unchanged', async () => {
    const url = await resolveCollectionCoverUrl({
      coverUrl: 'https://cdn.example.com/external-cover.jpg',
      coverKey: null,
    })
    expect(url).toBe('https://cdn.example.com/external-cover.jpg')
  })

  it('returns null when neither is set', async () => {
    const url = await resolveCollectionCoverUrl({ coverUrl: null, coverKey: null })
    expect(url).toBeNull()
  })
})
