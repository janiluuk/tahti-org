// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'smartlink-click-'

describe('Phase 9 — smart link clicks and analytics', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let releaseId: string
  let slug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'sl-click-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98401,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    const create = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie },
      payload: {
        title: 'Click Test Single',
        type: 'SINGLE',
        releaseDate: '2026-03-01',
        tracks: [{ title: 'Only Track', durationSec: 180 }],
      },
    })
    expect(create.statusCode).toBe(201)
    releaseId = create.json().id
    slug = create.json().smartLinkSlug

    const pub = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${releaseId}`,
      headers: { cookie },
      payload: {
        state: 'PUBLISHED',
        smartLinkTargets: { spotify: 'https://open.spotify.com/album/example' },
      },
    })
    expect(pub.statusCode).toBe(200)
  })

  afterAll(async () => {
    await prisma.smartLinkClick.deleteMany({
      where: { release: { user: { email: { startsWith: PREFIX } } } },
    })
    await prisma.release.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST /api/smartlink/click logs platform click', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/smartlink/click',
      payload: { smartLinkSlug: slug, platform: 'spotify', referer: 'https://example.com' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)

    const count = await prisma.smartLinkClick.count({ where: { releaseId, platform: 'spotify' } })
    expect(count).toBe(1)
  })

  it('GET /api/me/releases/:id/analytics returns views and clicks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/releases/${releaseId}/analytics`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().clicksByPlatform.spotify).toBe(1)
    expect(res.json().totalClicks).toBe(1)
  })

  it('GET /api/sitemap/releases.xml lists published release', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sitemap/releases.xml' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/xml/)
    expect(res.body).toContain(`/r/${slug}`)
  })
})
