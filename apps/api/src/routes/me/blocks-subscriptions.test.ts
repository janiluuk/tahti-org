// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'me-blocks-subs-'

describe('blocking an account and collection subscriptions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookieA: string
  let ids: { a: string; b: string; c: string }
  let collections: { a: string; b: string; c: string }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const make = async (name: 'a' | 'b' | 'c') => {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
      })
      const collection = await prisma.collection.create({
        data: { userId: user.id, slug: `${PREFIX}${name}`, name, isPublic: true },
      })
      return { userId: user.id, collectionId: collection.id }
    }
    const [a, b, c] = [await make('a'), await make('b'), await make('c')]
    ids = { a: a.userId, b: b.userId, c: c.userId }
    collections = { a: a.collectionId, b: b.collectionId, c: c.collectionId }
    cookieA = await sessionCookieFor(prisma, a.userId)
    await prisma.collectionSubscription.createMany({
      data: [
        { userId: ids.b, collectionId: collections.a },
        { userId: ids.a, collectionId: collections.b },
        { userId: ids.c, collectionId: collections.a },
        { userId: ids.a, collectionId: collections.c },
        { userId: ids.b, collectionId: collections.c },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('removes the subscriptions between the two and nobody else’s', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/blocks',
      headers: { cookie: cookieA },
      payload: { username: `${PREFIX}b` },
    })
    expect(res.statusCode).toBeLessThan(300)

    const left = await prisma.collectionSubscription.findMany({
      where: { collectionId: { in: Object.values(collections) } },
      select: { userId: true, collectionId: true },
    })
    const has = (userId: string, collectionId: string) =>
      left.some((s) => s.userId === userId && s.collectionId === collectionId)
    expect(has(ids.b, collections.a)).toBe(false)
    expect(has(ids.a, collections.b)).toBe(false)
    expect(has(ids.c, collections.a)).toBe(true)
    expect(has(ids.a, collections.c)).toBe(true)
    expect(has(ids.b, collections.c)).toBe(true)
  })
})
