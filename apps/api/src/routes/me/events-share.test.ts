// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/social-post.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/social-post.js')>()),
  enqueueSocialPostDispatch: vi.fn(async () => undefined),
}))

import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'events-share-'

describe('sharing a published event to Mastodon and Bluesky', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let artistId: string
  const later = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
  const posts = () =>
    prisma.socialPost.findMany({
      where: { userId: artistId, trigger: 'event_published' },
      orderBy: { createdAt: 'asc' },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    artistId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.socialConnection.create({
      data: {
        userId: artist.id,
        platform: 'MASTODON',
        instanceUrl: 'https://mastodon.example',
        accessTokenEnc: 'x',
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('queues a post only for connected platforms the artist picked, once', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'Harbour set',
        place: 'Kaiku',
        location: 'Helsinki',
        startAt: later(5),
        status: 'DRAFT',
        shareTo: ['MASTODON'],
      },
    })
    const id = (created.json() as { id: string }).id
    expect(await posts()).toHaveLength(0)

    const published = await app.inject({
      method: 'POST',
      url: `/api/me/events/${id}/publish`,
      headers: { cookie },
      payload: { shareTo: ['MASTODON', 'BLUESKY'] },
    })
    expect(published.statusCode).toBe(200)
    const rows = await posts()
    expect(rows.map((r) => r.platform)).toEqual(['MASTODON'])
    expect(rows[0]!.message).toContain('Harbour set')
    expect(rows[0]!.message).toContain(`/events/${id}`)

    await app.inject({ method: 'POST', url: `/api/me/events/${id}/cancel`, headers: { cookie } })
    await app.inject({
      method: 'POST',
      url: `/api/me/events/${id}/publish`,
      headers: { cookie },
      payload: { shareTo: ['MASTODON'] },
    })
    expect(await posts()).toHaveLength(1)
  })

  it('shares straight away when an event is created published', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'Pier session',
        place: 'Kaiku',
        location: 'Helsinki',
        startAt: later(9),
        shareTo: ['MASTODON'],
      },
    })
    expect((await posts()).map((r) => r.message.split(' —')[0])).toContain('Pier session')
  })

  it('publishes without a body and rejects unknown targets', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'Quiet one',
        place: 'Kaiku',
        location: 'Helsinki',
        startAt: later(12),
        status: 'DRAFT',
      },
    })
    const id = (created.json() as { id: string }).id
    const bad = await app.inject({
      method: 'POST',
      url: `/api/me/events/${id}/publish`,
      headers: { cookie },
      payload: { shareTo: ['MYSPACE'] },
    })
    expect(bad.statusCode).toBe(400)
    const ok = await app.inject({
      method: 'POST',
      url: `/api/me/events/${id}/publish`,
      headers: { cookie },
    })
    expect(ok.statusCode).toBe(200)
  })

  it('lists the event shares and retries a failed one', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'Status set',
        place: 'Kaiku',
        location: 'Helsinki',
        startAt: later(15),
        shareTo: ['MASTODON'],
      },
    })
    const id = (created.json() as { id: string }).id
    const list = await app.inject({
      method: 'GET',
      url: `/api/me/events/${id}/shares`,
      headers: { cookie },
    })
    const shares = list.json() as Array<{ id: string; platform: string; state: string }>
    expect(shares).toMatchObject([{ platform: 'MASTODON', state: 'PENDING' }])

    const pending = await app.inject({
      method: 'POST',
      url: `/api/me/events/${id}/shares/${shares[0]!.id}/retry`,
      headers: { cookie },
    })
    expect(pending.statusCode).toBe(409)

    await prisma.socialPost.update({
      where: { id: shares[0]!.id },
      data: { state: 'FAILED', error: 'boom' },
    })
    const retried = await app.inject({
      method: 'POST',
      url: `/api/me/events/${id}/shares/${shares[0]!.id}/retry`,
      headers: { cookie },
    })
    expect(retried.json()).toMatchObject({ state: 'PENDING', error: null })

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    const otherCookie = await sessionCookieFor(prisma, other.id)
    const hidden = await app.inject({
      method: 'GET',
      url: `/api/me/events/${id}/shares`,
      headers: { cookie: otherCookie },
    })
    expect(hidden.statusCode).toBe(404)
  })
})
