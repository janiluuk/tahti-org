// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, utimes, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  objectKeyFromUrl,
  trackUrlFromMetadata,
  trackSourceFromMetadata,
  playbackKeyFromMetadata,
  hlsSegmentsAreStale,
} from './now-playing-sync.js'

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

describe('trackSourceFromMetadata / playbackKeyFromMetadata', () => {
  it('resolves STREAM-009 local archive-cache paths to MinIO keys', () => {
    const raw =
      'annotate:extinf_duration="96",song="A Ghost Waltz":/archive-cache/cmr98ivcq000110xviim6vp9t/mp3__tahti-selects__cms3jggex00056a71ntkrsdvf.mp3'
    expect(trackSourceFromMetadata(raw)).toBe(
      '/archive-cache/cmr98ivcq000110xviim6vp9t/mp3__tahti-selects__cms3jggex00056a71ntkrsdvf.mp3',
    )
    expect(playbackKeyFromMetadata(raw)).toBe('mp3/tahti-selects/cms3jggex00056a71ntkrsdvf.mp3')
  })

  it('still resolves remote presigned URLs to object keys', () => {
    const raw =
      'annotate:extinf_duration="270",song="Lag":http://localhost:19000/tahti/mp3/tahti-selects/abc.mp3?X-Amz-Signature=abc'
    expect(playbackKeyFromMetadata(raw)).toBe('mp3/tahti-selects/abc.mp3')
  })

  it('ignores liquidsoap decode temp files', () => {
    expect(trackSourceFromMetadata('/tmp/liq-processdcf67a.osb')).toBeNull()
    expect(playbackKeyFromMetadata('/tmp/liq-processdcf67a.osb')).toBeNull()
  })
})

describe('hlsSegmentsAreStale', () => {
  async function tempHlsRoot(): Promise<string> {
    return mkdtemp(join(tmpdir(), 'hls-watchdog-'))
  }

  it('is not stale when a segment was just written', async () => {
    const root = await tempHlsRoot()
    const dir = join(root, 'chan-1')
    await mkdir(dir)
    await writeFile(join(dir, 'stream-mp3-192_1.ts'), 'x')

    expect(await hlsSegmentsAreStale('chan-1', root)).toBe(false)
    await rm(root, { recursive: true, force: true })
  })

  it('is stale when the newest segment is old', async () => {
    const root = await tempHlsRoot()
    const dir = join(root, 'chan-1')
    await mkdir(dir)
    const file = join(dir, 'stream-mp3-192_1.ts')
    await writeFile(file, 'x')
    const old = new Date(Date.now() - 60_000)
    await utimes(file, old, old)

    expect(await hlsSegmentsAreStale('chan-1', root)).toBe(true)
    await rm(root, { recursive: true, force: true })
  })

  it('is not stale (unknown, not a failure) when the channel has no HLS dir yet', async () => {
    const root = await tempHlsRoot()
    expect(await hlsSegmentsAreStale('never-spawned', root)).toBe(false)
    await rm(root, { recursive: true, force: true })
  })

  it('ignores non-.ts files in the directory', async () => {
    const root = await tempHlsRoot()
    const dir = join(root, 'chan-1')
    await mkdir(dir)
    await writeFile(join(dir, 'stream.m3u8'), 'x')

    expect(await hlsSegmentsAreStale('chan-1', root)).toBe(false)
    await rm(root, { recursive: true, force: true })
  })
})
