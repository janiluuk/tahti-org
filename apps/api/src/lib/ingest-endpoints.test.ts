// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  parseIngestHostList,
  rtmpPublishUrl,
  resolveIcecastIngestHosts,
  resolveRtmpIngestHosts,
  resetIngestHostCacheForTests,
} from './ingest-endpoints.js'

describe('ingest-endpoints', () => {
  beforeEach(() => {
    resetIngestHostCacheForTests()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses comma-separated ingest hosts', () => {
    expect(parseIngestHostList('a.example,b.example', 'fallback')).toEqual([
      'a.example',
      'b.example',
    ])
    expect(parseIngestHostList(undefined, 'ingest.tahti.live')).toEqual(['ingest.tahti.live'])
  })

  it('builds RTMP publish URLs', () => {
    expect(rtmpPublishUrl('ingest.tahti.live')).toBe('rtmp://ingest.tahti.live:1935/live')
  })

  it('prefers healthy RTMP ingest hosts', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('good')) return new Response('ok', { status: 200 })
      return new Response('down', { status: 503 })
    })

    const result = await resolveRtmpIngestHosts({
      hosts: ['bad.example', 'good.example'],
      healthPort: 8080,
      healthPath: '/health',
    })

    expect(result.server).toBe('rtmp://good.example:1935/live')
    expect(result.fallbackServers).toEqual(['rtmp://bad.example:1935/live'])
  })

  it('returns fallbacks for Icecast when primary probe fails', async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('ice-b')) return new Response('ok', { status: 200 })
      return new Response('down', { status: 503 })
    })

    const result = await resolveIcecastIngestHosts({
      hosts: ['ice-a.example', 'ice-b.example'],
      defaultScheme: 'https',
    })

    expect(result.server).toBe('https://ice-b.example')
    expect(result.fallbackServers).toEqual(['https://ice-a.example'])
  })
})
