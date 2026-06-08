// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parseHlsCaddyLogLine, readHlsCaddyLogFromOffset } from './hls-caddy-egress-log.js'

describe('parseHlsCaddyLogLine', () => {
  it('extracts slug, bytes, and client IP from a Caddy JSON line', () => {
    const line = JSON.stringify({
      ts: 1_700_000_000,
      status: 200,
      size: 4096,
      request: {
        uri: '/demo-artist/stream.m3u8',
        host: 'stream.tahti.live',
        client_ip: '203.0.113.7',
      },
    })
    expect(parseHlsCaddyLogLine(line)).toEqual({
      slug: 'demo-artist',
      bytes: 4096,
      utcDate: '2023-11-14',
      clientIp: '203.0.113.7',
    })
  })

  it('falls back to remote_ip when client_ip is absent, else null', () => {
    const withRemote = JSON.stringify({
      status: 200,
      size: 100,
      request: { uri: '/demo-artist/seg.ts', remote_ip: '198.51.100.2' },
    })
    expect(parseHlsCaddyLogLine(withRemote)?.clientIp).toBe('198.51.100.2')

    const withNeither = JSON.stringify({
      status: 200,
      size: 100,
      request: { uri: '/demo-artist/seg.ts' },
    })
    expect(parseHlsCaddyLogLine(withNeither)?.clientIp).toBeNull()
  })

  it('ignores non-200 and zero-byte responses', () => {
    const miss = JSON.stringify({ status: 404, size: 0, request: { uri: '/x/y.ts' } })
    expect(parseHlsCaddyLogLine(miss)).toBeNull()
  })
})

describe('readHlsCaddyLogFromOffset', () => {
  it('reads new lines and advances offset', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tahti-caddy-log-'))
    const path = join(dir, 'hls-access.log')
    const line = JSON.stringify({
      status: 200,
      size: 100,
      request: { uri: '/slug-a/stream-1.ts' },
    })
    await writeFile(path, `${line}\n`)
    const first = await readHlsCaddyLogFromOffset(path, 0)
    expect(first.events).toHaveLength(1)
    expect(first.nextOffset).toBeGreaterThan(0)

    const second = await readHlsCaddyLogFromOffset(path, first.nextOffset)
    expect(second.events).toHaveLength(0)
    await rm(dir, { recursive: true, force: true })
  })
})
