// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { objectKeyFromUrl, trackUrlFromMetadata } from './now-playing-sync.js'

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

describe('trackUrlFromMetadata', () => {
  // Exact format captured from a real production track's on_metadata "initial_uri"
  // (dumped every metadata key against the live tahti-selects rotation to confirm
  // this — "filename" is a local ffmpeg temp path, not the source, for this exact
  // case).
  it('extracts the URL from an annotate:-wrapped initial_uri', () => {
    const raw =
      'annotate:extinf_duration="270",song="Lag":https://cdn.tahti.live/tahti/mp3/tahti-selects/cmrispn6g000pnq0q6p28yd4e.mp3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc'
    expect(trackUrlFromMetadata(raw)).toBe(
      'https://cdn.tahti.live/tahti/mp3/tahti-selects/cmrispn6g000pnq0q6p28yd4e.mp3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc',
    )
  })

  it('passes through a bare URL with no annotate wrapper', () => {
    expect(trackUrlFromMetadata('https://cdn.tahti.live/tahti/mp3/a.mp3')).toBe(
      'https://cdn.tahti.live/tahti/mp3/a.mp3',
    )
  })

  it('returns null for a local path with no URL at all', () => {
    expect(trackUrlFromMetadata('/tmp/liq-processdcf67a.osb')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(trackUrlFromMetadata('')).toBeNull()
  })
})
