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

  it('POST /follow writes exactly one ARTIST_FOLLOW audit row, not one per repeat call', async () => {
    const artist2 = await createTestArtist(prisma, {
      email: `${PREFIX}artist2@example.com`,
      username: `${PREFIX}artist2`,
      tier: 'ARTIST',
    })
    const follower2 = await createTestArtist(prisma, {
      email: `${PREFIX}follower2@example.com`,
      username: `${PREFIX}follower2`,
      tier: 'ARTIST',
    })
    const follower2Cookie = await sessionCookieFor(prisma, follower2.id)

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/artists/${PREFIX}artist2/follow`,
      headers: { cookie: follower2Cookie },
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/artists/${PREFIX}artist2/follow`,
      headers: { cookie: follower2Cookie },
    })
    expect(second.statusCode).toBe(200)

    const rows = await prisma.auditLog.findMany({
      where: { action: 'ARTIST_FOLLOW', actorId: follower2.id, targetId: artist2.id },
    })
    expect(rows).toHaveLength(1)
  })

  describe('unavailable accounts and unsafe names', () => {
    let hostId: string
    let hostUsername: string
    let suspendedId: string
    let deletedId: string

    beforeAll(async () => {
      const host = await createTestArtist(prisma, {
        email: `${PREFIX}host@example.com`,
        username: `${PREFIX}host`,
        tier: 'ARTIST',
      })
      hostId = host.id
      hostUsername = host.username
      const emailNamed = await createTestArtist(prisma, {
        email: `${PREFIX}emailnamed@example.com`,
        username: `${PREFIX}emailnamed`,
        displayName: `${PREFIX}emailnamed@example.com`,
        tier: 'ARTIST',
      })
      const suspended = await createTestArtist(prisma, {
        email: `${PREFIX}suspended@example.com`,
        username: `${PREFIX}suspended`,
        tier: 'ARTIST',
      })
      suspendedId = suspended.id
      const deleted = await createTestArtist(prisma, {
        email: `${PREFIX}deleted@example.com`,
        username: `${PREFIX}deleted`,
        tier: 'ARTIST',
      })
      deletedId = deleted.id
      await prisma.user.update({ where: { id: suspendedId }, data: { suspendedAt: new Date() } })
      await prisma.user.update({ where: { id: deletedId }, data: { deletedAt: new Date() } })

      for (const other of [emailNamed.id, suspendedId, deletedId]) {
        await prisma.artistFollow.create({ data: { followerUserId: other, artistUserId: hostId } })
        await prisma.artistFollow.create({ data: { followerUserId: hostId, artistUserId: other } })
      }
    })

    it('leaves suspended and deleted followers out of the list and count', async () => {
      const list = await app.inject({
        method: 'GET',
        url: `/api/v1/artists/${hostUsername}/followers`,
      })
      const body = list.json() as { users: Array<{ username: string; displayName: string }> }
      expect(body.users.map((u) => u.username)).toEqual([`${PREFIX}emailnamed`])

      const count = await app.inject({
        method: 'GET',
        url: `/api/v1/artists/${hostUsername}/follow`,
      })
      expect(count.json().followerCount).toBe(1)
    })

    it('leaves suspended and deleted artists out of the following list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/artists/${hostUsername}/following`,
      })
      const body = res.json() as { users: Array<{ username: string }> }
      expect(body.users.map((u) => u.username)).toEqual([`${PREFIX}emailnamed`])
    })

    it('never sends an email address as a listed name', async () => {
      for (const direction of ['followers', 'following']) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/artists/${hostUsername}/${direction}`,
        })
        const body = res.json() as { users: Array<{ displayName: string }> }
        expect(body.users[0]?.displayName).toBe(`${PREFIX}emailnamed`)
      }
    })

    it('counts only available followers after follow and unfollow', async () => {
      const viewer = await createTestArtist(prisma, {
        email: `${PREFIX}viewer@example.com`,
        username: `${PREFIX}viewer`,
        tier: 'ARTIST',
      })
      const cookie = await sessionCookieFor(prisma, viewer.id)
      const followed = await app.inject({
        method: 'POST',
        url: `/api/v1/artists/${hostUsername}/follow`,
        headers: { cookie },
      })
      expect(followed.json().followerCount).toBe(2)
      const unfollowed = await app.inject({
        method: 'DELETE',
        url: `/api/v1/artists/${hostUsername}/follow`,
        headers: { cookie },
      })
      expect(unfollowed.json().followerCount).toBe(1)
    })
  })

  it('refuses a new follow of a suspended or deleted artist', async () => {
    const target = await createTestArtist(prisma, {
      email: `${PREFIX}gone@example.com`,
      username: `${PREFIX}gone`,
    })
    const follow = () =>
      app.inject({
        method: 'POST',
        url: `/api/v1/artists/${PREFIX}gone/follow`,
        headers: { cookie: followerCookie },
      })
    await prisma.user.update({ where: { id: target.id }, data: { suspendedAt: new Date() } })
    expect((await follow()).statusCode).toBe(404)
    await prisma.user.update({
      where: { id: target.id },
      data: { suspendedAt: null, deletedAt: new Date() },
    })
    expect((await follow()).statusCode).toBe(404)
    expect(await prisma.artistFollow.count({ where: { artistUserId: target.id } })).toBe(0)

    await prisma.user.update({ where: { id: target.id }, data: { deletedAt: null } })
    expect((await follow()).statusCode).toBe(200)
  })
})
