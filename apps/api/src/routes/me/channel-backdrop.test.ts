// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'channel-backdrop-route-'

describe('channel backdrop upload routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let username: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'channel-backdrop-route-user',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98545,
    })
    username = artist.username
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
    vi.unstubAllGlobals()
  })

  it('POST prepare accepts a video file and returns a presigned URL scoped to the account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/video-background/prepare',
      headers: { cookie },
      payload: { filename: 'loop.mp4', contentType: 'video/mp4', fileSizeBytes: 1024 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { uploadKey: string; uploadUrl: string }
    expect(body.uploadKey).toContain(`channel-backdrops/${username}/`)
    expect(body.uploadUrl).toMatch(/^https?:\/\//)
  })

  it('POST prepare also accepts a static image file (same backdrop slot)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/video-background/prepare',
      headers: { cookie },
      payload: { filename: 'backdrop.png', contentType: 'image/png', fileSizeBytes: 1024 },
    })
    expect(res.statusCode).toBe(200)
  })

  it('POST prepare rejects an unsupported content type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/video-background/prepare',
      headers: { cookie },
      payload: { filename: 'x.pdf', contentType: 'application/pdf', fileSizeBytes: 1024 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST complete rejects an upload key belonging to a different account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/video-background/complete',
      headers: { cookie },
      payload: { uploadKey: 'channel-backdrops/someone-else/x.mp4' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST complete returns a videoBackgroundUrl for an owned upload key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/video-background/complete',
      headers: { cookie },
      payload: { uploadKey: `channel-backdrops/${username}/loop-abc123.mp4` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().videoBackgroundUrl).toContain(`channel-backdrops/${username}/loop-abc123.mp4`)
  })
})
