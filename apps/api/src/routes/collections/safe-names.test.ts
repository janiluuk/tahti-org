// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'collection-added-by-'
const SLUG = 'collection-added-by-mix'
const EMAIL_NAME = 'contributor@example.com'
const OWNER_EMAIL_NAME = 'owner@example.com'

type Item = { id: string; addedBy: { username: string; displayName: string } | null }

describe('collection items never name people by an email address', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let contributorUsername: string
  let ownerUsername: string
  let itemIds: string[]

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.collection.deleteMany({ where: { slug: SLUG } })
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const contributor = await createTestArtist(prisma, {
      email: `${PREFIX}contributor@example.com`,
      username: `${PREFIX}contributor`,
    })
    // Older accounts can still hold an email display name the API now rejects.
    await prisma.user.update({ where: { id: contributor.id }, data: { displayName: EMAIL_NAME } })
    await prisma.user.update({ where: { id: owner.id }, data: { displayName: OWNER_EMAIL_NAME } })
    contributorUsername = contributor.username
    ownerUsername = owner.username
    cookie = await sessionCookieFor(prisma, owner.id)
    const first = await createReadySound(prisma, contributor.channel!.id, 'Contributed one')
    const second = await createReadySound(prisma, owner.channel!.id, 'Owner pick')
    const col = await prisma.collection.create({
      data: {
        userId: owner.id,
        slug: SLUG,
        name: 'Shared mix',
        isPublic: true,
        collaborative: true,
        items: {
          create: [
            { position: 1, soundId: first.id, addedByUserId: contributor.id },
            { position: 2, soundId: second.id },
          ],
        },
      },
      include: { items: { orderBy: { position: 'asc' } } },
    })
    itemIds = col.items.map((i) => i.id)
  })

  afterAll(async () => {
    await prisma.collection.deleteMany({ where: { slug: SLUG } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const expectSafe = (items: Item[]) => {
    const added = items.find((i) => i.addedBy)
    expect(added?.addedBy).toEqual({
      username: contributorUsername,
      displayName: contributorUsername,
    })
    expect(JSON.stringify(items)).not.toContain(EMAIL_NAME)
    expect(JSON.stringify(items)).not.toContain(OWNER_EMAIL_NAME)
  }

  it('on the public collection page', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/collections/${SLUG}` })
    expect(res.statusCode).toBe(200)
    expectSafe(res.json().items)
    expect(res.json().user.displayName).toBe(ownerUsername)
  })

  it('in the public RSS feed', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/collections/${SLUG}/rss.xml` })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain(OWNER_EMAIL_NAME)
    expect(res.body).not.toContain(EMAIL_NAME)
  })

  it('in the owner management view', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/collections/${SLUG}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expectSafe(res.json().items)
  })

  it('in the owner collection list with items expanded', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/collections?expand=items',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const col = (res.json() as Array<{ slug: string; items: Item[] }>).find((c) => c.slug === SLUG)
    expectSafe(col!.items)
  })

  it('after reordering items', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/me/collections/${SLUG}/reorder`,
      headers: { cookie },
      payload: { itemIds: [...itemIds].reverse() },
    })
    expect(res.statusCode).toBe(200)
    expectSafe(res.json().items)
  })
})
