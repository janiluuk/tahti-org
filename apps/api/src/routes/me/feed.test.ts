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

const PREFIX = 'feed-release-'

describe('GET /api/me/feed — Tahti Radio release announces', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let followerCookie: string
  let optedInCookie: string
  let optedOutCookie: string
  let optedInArtistId: string
  let optedOutArtistId: string
  let followerId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}follower@example.com`,
      username: 'feed-release-follower',
    })
    const optedIn = await createTestArtist(prisma, {
      email: `${PREFIX}in@example.com`,
      username: 'feed-release-in',
      displayName: 'Radio In Artist',
      isMember: true,
      tier: 'ARTIST',
    })
    const optedOut = await createTestArtist(prisma, {
      email: `${PREFIX}out@example.com`,
      username: 'feed-release-out',
      displayName: 'Radio Out Artist',
      isMember: true,
      tier: 'ARTIST',
    })

    followerId = follower.id
    optedInArtistId = optedIn.id
    optedOutArtistId = optedOut.id
    followerCookie = await sessionCookieFor(prisma, follower.id)
    optedInCookie = await sessionCookieFor(prisma, optedIn.id)
    optedOutCookie = await sessionCookieFor(prisma, optedOut.id)

    await prisma.channel.update({
      where: { userId: optedIn.id },
      data: { metaStreamOptOut: false },
    })
    await prisma.channel.update({
      where: { userId: optedOut.id },
      data: { metaStreamOptOut: true },
    })

    await prisma.artistFollow.createMany({
      data: [
        { followerUserId: follower.id, artistUserId: optedIn.id },
        { followerUserId: follower.id, artistUserId: optedOut.id },
      ],
    })
  })

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId: followerId } })
    await prisma.release.deleteMany({
      where: { userId: { in: [optedInArtistId, optedOutArtistId] } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('announces published releases for radio-opted-in artists on the follower feed', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie: optedInCookie },
      payload: {
        title: 'Radio Feed EP',
        type: 'EP',
        releaseDate: '2026-08-01',
        tracks: [{ title: 'A1', durationSec: 180 }],
      },
    })
    expect(create.statusCode).toBe(201)
    const releaseId = create.json().id as string

    const pub = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${releaseId}`,
      headers: { cookie: optedInCookie },
      payload: { state: 'PUBLISHED' },
    })
    expect(pub.statusCode).toBe(200)

    // Allow async notify fan-out to settle.
    await new Promise((r) => setTimeout(r, 50))

    const feed = await app.inject({
      method: 'GET',
      url: '/api/me/feed',
      headers: { cookie: followerCookie },
    })
    expect(feed.statusCode).toBe(200)
    const body = feed.json() as {
      items: Array<{ kind: string; id: string; title: string }>
    }
    const releaseItem = body.items.find((i) => i.kind === 'release' && i.id === releaseId)
    expect(releaseItem).toBeTruthy()
    expect(releaseItem!.title).toBe('Radio Feed EP')

    const notifs = await prisma.notification.findMany({
      where: { userId: followerId, type: 'NEW_RELEASE', actorUserId: optedInArtistId },
    })
    expect(notifs.length).toBeGreaterThanOrEqual(1)
    expect(notifs[0]!.title).toContain('Radio Feed EP')
  })

  it('does not put opted-out artists releases on the follower feed', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/releases',
      headers: { cookie: optedOutCookie },
      payload: {
        title: 'Hidden Out EP',
        type: 'EP',
        releaseDate: '2026-08-01',
        tracks: [{ title: 'B1', durationSec: 180 }],
      },
    })
    expect(create.statusCode).toBe(201)
    const releaseId = create.json().id as string

    const pub = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${releaseId}`,
      headers: { cookie: optedOutCookie },
      payload: { state: 'PUBLISHED' },
    })
    expect(pub.statusCode).toBe(200)

    await new Promise((r) => setTimeout(r, 50))

    const feed = await app.inject({
      method: 'GET',
      url: '/api/me/feed',
      headers: { cookie: followerCookie },
    })
    const body = feed.json() as { items: Array<{ kind: string; id: string }> }
    expect(body.items.some((i) => i.kind === 'release' && i.id === releaseId)).toBe(false)

    const notifs = await prisma.notification.findMany({
      where: { userId: followerId, type: 'NEW_RELEASE', actorUserId: optedOutArtistId },
    })
    expect(notifs).toHaveLength(0)
  })
})
