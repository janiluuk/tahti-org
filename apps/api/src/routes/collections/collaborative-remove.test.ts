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

const PREFIX = 'col-collab-remove-'

describe('DELETE /api/v1/collections/:slug/items/:itemId', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let guestCookie: string
  let otherCookie: string
  let ownerItemId: string
  let soundId: string
  const slug = `${PREFIX}mix`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const guest = await createTestArtist(prisma, {
      email: `${PREFIX}guest@example.com`,
      username: `${PREFIX}guest`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    guestCookie = await sessionCookieFor(prisma, guest.id)
    otherCookie = await sessionCookieFor(prisma, other.id)
    const col = await prisma.collection.create({
      data: { userId: owner.id, slug, name: 'Mix', isPublic: true, collaborative: true },
    })
    const s1 = await prisma.sound.create({
      data: { channelId: owner.channel!.id, title: 'Owner pick', status: 'READY', isPublic: true },
    })
    const s2 = await prisma.sound.create({
      data: { channelId: owner.channel!.id, title: 'Guest pick', status: 'READY', isPublic: true },
    })
    soundId = s2.id
    ownerItemId = (
      await prisma.collectionItem.create({
        data: { collectionId: col.id, soundId: s1.id, position: 0, addedByUserId: owner.id },
      })
    ).id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lets a guest take back their own add, and only their own', async () => {
    const added = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${slug}/items`,
      headers: { cookie: guestCookie },
      payload: { soundId },
    })
    expect(added.statusCode).toBe(201)
    const itemId = added.json().id as string

    const byOther = await app.inject({
      method: 'DELETE',
      url: `/api/v1/collections/${slug}/items/${itemId}`,
      headers: { cookie: otherCookie },
    })
    expect(byOther.statusCode).toBe(403)

    const ownerItem = await app.inject({
      method: 'DELETE',
      url: `/api/v1/collections/${slug}/items/${ownerItemId}`,
      headers: { cookie: guestCookie },
    })
    expect(ownerItem.statusCode).toBe(403)

    const undo = await app.inject({
      method: 'DELETE',
      url: `/api/v1/collections/${slug}/items/${itemId}`,
      headers: { cookie: guestCookie },
    })
    expect(undo.statusCode).toBe(204)
    expect(await prisma.collectionItem.findUnique({ where: { id: itemId } })).toBeNull()
    expect(await prisma.collectionItem.findUnique({ where: { id: ownerItemId } })).not.toBeNull()
  })

  it('answers 404 for an unknown item and 401 when signed out', async () => {
    const missing = await app.inject({
      method: 'DELETE',
      url: `/api/v1/collections/${slug}/items/nope`,
      headers: { cookie: guestCookie },
    })
    expect(missing.statusCode).toBe(404)
    const anon = await app.inject({
      method: 'DELETE',
      url: `/api/v1/collections/${slug}/items/${ownerItemId}`,
    })
    expect(anon.statusCode).toBe(401)
  })
})
