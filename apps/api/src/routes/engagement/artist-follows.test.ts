// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { createTestArtist, sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'artist-follow-list-'

describe('artist followers/following list routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let artistUsername: string
  let artistCookie: string
  let followerCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
    })
    artistId = artist.id
    artistUsername = artist.username
    artistCookie = await sessionCookieFor(prisma, artist.id)

    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}follower@example.com`,
      username: `${PREFIX}follower`,
      tier: 'ARTIST',
    })
    followerCookie = await sessionCookieFor(prisma, follower.id)

    await prisma.artistFollow.create({
      data: { followerUserId: follower.id, artistUserId: artist.id },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('lists followers publicly by default (showFollowers defaults to true)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/artists/${artistUsername}/followers`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { users: Array<{ username: string }>; hasMore: boolean }
    expect(body.users.map((u) => u.username)).toContain(`${PREFIX}follower`)
    expect(body.hasMore).toBe(false)
  })

  it('hides the followers list from other visitors once showFollowers is off', async () => {
    await prisma.user.update({ where: { id: artistId }, data: { showFollowers: false } })

    const anonRes = await app.inject({
      method: 'GET',
      url: `/api/v1/artists/${artistUsername}/followers`,
    })
    expect(anonRes.json()).toEqual({ users: [], hasMore: false })

    const otherViewerRes = await app.inject({
      method: 'GET',
      url: `/api/v1/artists/${artistUsername}/followers`,
      headers: { cookie: followerCookie },
    })
    expect(otherViewerRes.json()).toEqual({ users: [], hasMore: false })

    await prisma.user.update({ where: { id: artistId }, data: { showFollowers: true } })
  })

  it('still shows the artist their own followers list when hidden from others', async () => {
    await prisma.user.update({ where: { id: artistId }, data: { showFollowers: false } })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/artists/${artistUsername}/followers`,
      headers: { cookie: artistCookie },
    })
    const body = res.json() as { users: Array<{ username: string }> }
    expect(body.users.map((u) => u.username)).toContain(`${PREFIX}follower`)

    await prisma.user.update({ where: { id: artistId }, data: { showFollowers: true } })
  })

  it('lists who the artist follows via the /following endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/artists/${PREFIX}follower/following`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { users: Array<{ username: string }> }
    expect(body.users.map((u) => u.username)).toContain(artistUsername)
  })

  it('respects showFollowing independently of showFollowers', async () => {
    const follower = await prisma.user.findUniqueOrThrow({
      where: { username: `${PREFIX}follower` },
      select: { id: true },
    })
    await prisma.user.update({ where: { id: follower.id }, data: { showFollowing: false } })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/artists/${PREFIX}follower/following`,
    })
    expect(res.json()).toEqual({ users: [], hasMore: false })

    // showFollowers-equivalent check for the follower's own followers list is unaffected.
    const followersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/artists/${PREFIX}follower/followers`,
    })
    expect(followersRes.statusCode).toBe(200)
  })

  it('404s for an unknown username', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/artists/does-not-exist-xyz/followers',
    })
    expect(res.statusCode).toBe(404)
  })
})
