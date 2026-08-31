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

const PREFIX = 'media-route-'

describe('generic media upload routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let username: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'media-route-user',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98544,
    })
    username = artist.username
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
    vi.unstubAllGlobals()
  })

  it('POST prepare returns a presigned upload URL scoped to the account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/media/prepare',
      headers: { cookie },
      payload: { filename: 'cover.png', contentType: 'image/png' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { uploadKey: string; uploadUrl: string }
    expect(body.uploadKey).toContain(`media/${username}/`)
    expect(body.uploadUrl).toMatch(/^https?:\/\//)
  })

  it('POST complete rejects an upload key belonging to a different account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/media/complete',
      headers: { cookie },
      payload: {
        uploadKey: 'media/someone-else/x.png',
        filename: 'x.png',
        contentType: 'image/png',
        sizeBytes: 1024,
      },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST complete returns a full UserMediaFile for an owned upload key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/media/complete',
      headers: { cookie },
      payload: {
        uploadKey: `media/${username}/cover-abc123.png`,
        filename: 'cover.png',
        contentType: 'image/png',
        sizeBytes: 2048,
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(`media/${username}/cover-abc123.png`)
    expect(body.filename).toBe('cover.png')
    expect(body.contentType).toBe('image/png')
    expect(body.sizeBytes).toBe(2048)
    expect(body.url).toContain(`media/${username}/cover-abc123.png`)
  })

  it('rejects an unauthenticated prepare request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/media/prepare',
      payload: { filename: 'x.png', contentType: 'image/png' },
    })
    expect(res.statusCode).toBe(401)
  })
})
