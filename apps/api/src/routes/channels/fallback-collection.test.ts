// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { createTestArtist, sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'fallback-collection-'

describe('channel fallback-collection routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let boardCookie: string
  let strangerCookie: string
  let channelSlug: string
  let channelId: string
  let ownerUserId: string
  let collectionId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98393,
    })
    channelSlug = owner.channel!.slug
    channelId = owner.channel!.id
    ownerUserId = owner.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      tier: 'ARTIST',
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const stranger = await createTestArtist(prisma, {
      email: `${PREFIX}stranger@example.com`,
      username: `${PREFIX}stranger`,
      tier: 'ARTIST',
    })
    strangerCookie = await sessionCookieFor(prisma, stranger.id)

    const collection = await prisma.collection.create({
      data: { userId: ownerUserId, slug: `${PREFIX}collection`, name: 'Late night mixes' },
    })
    collectionId = collection.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  describe('GET /api/channels/:slug/fallback-collections', () => {
    it('requires auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/channels/${channelSlug}/fallback-collections`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('rejects a user who is neither the owner nor board', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/channels/${channelSlug}/fallback-collections`,
        headers: { cookie: strangerCookie },
      })
      expect(res.statusCode).toBe(403)
    })

    it('lists the channel owner collections for the owner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/channels/${channelSlug}/fallback-collections`,
        headers: { cookie: ownerCookie },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Array<{ id: string; name: string; active: boolean }>
      expect(body).toHaveLength(1)
      expect(body[0]).toMatchObject({ id: collectionId, name: 'Late night mixes', active: false })
    })

    it('lets a board member list a channel that is not their own', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/channels/${channelSlug}/fallback-collections`,
        headers: { cookie: boardCookie },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toHaveLength(1)
    })
  })

  describe('PATCH /api/channels/:slug/fallback-collection', () => {
    it('rejects a stranger', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/channels/${channelSlug}/fallback-collection`,
        headers: { cookie: strangerCookie },
        payload: { collectionId },
      })
      expect(res.statusCode).toBe(403)
    })

    it('rejects a collection that does not belong to the channel owner', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/channels/${channelSlug}/fallback-collection`,
        headers: { cookie: ownerCookie },
        payload: { collectionId: 'not-a-real-collection' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('sets the active fallback collection and reflects it back in the list', async () => {
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/channels/${channelSlug}/fallback-collection`,
        headers: { cookie: ownerCookie },
        payload: { collectionId },
      })
      expect(patchRes.statusCode).toBe(200)
      expect(patchRes.json()).toEqual({ ok: true })

      const listRes = await app.inject({
        method: 'GET',
        url: `/api/channels/${channelSlug}/fallback-collections`,
        headers: { cookie: ownerCookie },
      })
      const body = listRes.json() as Array<{ id: string; active: boolean }>
      expect(body.find((c) => c.id === collectionId)?.active).toBe(true)
    })

    it('clears back to the default rotation with collectionId: null', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/channels/${channelSlug}/fallback-collection`,
        headers: { cookie: ownerCookie },
        payload: { collectionId: null },
      })
      expect(res.statusCode).toBe(200)

      const channel = await prisma.channel.findUniqueOrThrow({
        where: { id: channelId },
        select: { activeFallbackCollectionId: true },
      })
      expect(channel.activeFallbackCollectionId).toBeNull()
    })
  })
})
