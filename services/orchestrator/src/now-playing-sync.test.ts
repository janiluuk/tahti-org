// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { objectKeyFromUrl } from './now-playing-sync.js'

describe('objectKeyFromUrl', () => {
  it('strips the public endpoint, bucket, and presigned query string', () => {
    expect(
      objectKeyFromUrl(
        'http://localhost:19000/tahti/tahti/mp3/tahti-selects/a.mp3?X-Amz-Signature=abc',
      ),
    ).toBe('tahti/mp3/tahti-selects/a.mp3')
  })

  it('handles a key with no query string', () => {
    expect(objectKeyFromUrl('http://localhost:19000/tahti/tahti/mp3/a.mp3')).toBe('tahti/mp3/a.mp3')
  })

  it('returns null for a URL outside the configured endpoint/bucket', () => {
    expect(objectKeyFromUrl('https://example.com/other/file.mp3')).toBeNull()
  })

  it('returns null for an empty filename', () => {
    expect(objectKeyFromUrl('')).toBeNull()
  })
})
