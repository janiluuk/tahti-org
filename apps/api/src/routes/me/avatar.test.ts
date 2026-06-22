// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'avatar-route-'

describe('avatar upload routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let username: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'avatar-route-user',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98543,
    })
    username = artist.username
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
    vi.unstubAllGlobals()
  })

  it('POST prepare returns a presigned upload URL scoped to the artist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/profile/avatar/prepare',
      headers: { cookie },
      payload: { filename: 'me.jpg', contentType: 'image/jpeg' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { uploadKey: string; uploadUrl: string }
    expect(body.uploadKey).toContain(`avatars/${username}/avatar-`)
    expect(body.uploadUrl).toMatch(/^https?:\/\//)
  })

  it('POST complete rejects an upload key belonging to a different account', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/profile/avatar/complete',
      headers: { cookie },
      payload: { uploadKey: 'avatars/someone-else/avatar-x.jpg' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST complete persists avatarUrl for an owned upload key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/profile/avatar/complete',
      headers: { cookie },
      payload: { uploadKey: `avatars/${username}/avatar-abc12345.jpg` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().avatarUrl).toContain(`avatars/${username}/avatar-abc12345.jpg`)
  })

  it('GET proxy rejects a non-image content-type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('not an image', { status: 200, headers: { 'content-type': 'text/html' } })),
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/profile/avatar/proxy?url=https://example.com/page.html',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(415)
  })

  it('GET proxy rejects an oversized image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('', {
          status: 200,
          headers: { 'content-type': 'image/jpeg', 'content-length': String(50 * 1024 * 1024) },
        }),
      ),
    )
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/profile/avatar/proxy?url=https://example.com/huge.jpg',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(413)
  })

  it('GET proxy rejects an invalid URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/profile/avatar/proxy?url=not-a-url',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('requires auth on all three routes', async () => {
    const prepare = await app.inject({
      method: 'POST',
      url: '/api/me/profile/avatar/prepare',
      payload: { filename: 'a.jpg', contentType: 'image/jpeg' },
    })
    expect(prepare.statusCode).toBe(401)

    const complete = await app.inject({
      method: 'POST',
      url: '/api/me/profile/avatar/complete',
      payload: { uploadKey: 'avatars/x/a.jpg' },
    })
    expect(complete.statusCode).toBe(401)

    const proxy = await app.inject({
      method: 'GET',
      url: '/api/me/profile/avatar/proxy?url=https://example.com/a.jpg',
    })
    expect(proxy.statusCode).toBe(401)
  })
})
