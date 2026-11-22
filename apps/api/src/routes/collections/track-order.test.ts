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
import { compactCollectionPositions } from './helpers.js'

const PREFIX = 'collection-track-order-'

type Row = { id: string; position: number; trackNumber: number; sound: { title: string } | null }

describe('album track order: numbering, owner and board reorder', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let otherCookie: string
  let boardCookie: string
  let collectionId: string
  let channelId: string
  const slug = `${PREFIX}album`

  async function storedPositions() {
    const items = await prisma.collectionItem.findMany({
      where: { collectionId },
      orderBy: { position: 'asc' },
      select: { position: true, sound: { select: { title: true } } },
    })
    return items.map((item) => [item.position, item.sound?.title])
  }

  async function newSound(title: string, isPublic = true) {
    return prisma.sound.create({
      data: {
        channelId,
        title,
        status: 'READY',
        isPublic,
        mp3Key: `mp3/${PREFIX}${title.replace(/\W+/g, '-')}.mp3`,
      },
    })
  }

  async function addItem(soundId: string, position?: number) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${slug}/items`,
      headers: { cookie: ownerCookie },
      payload: position === undefined ? { soundId } : { soundId, position },
    })
    expect(res.statusCode).toBe(201)
    return res.json() as { id: string; position: number }
  }

  async function ownerItems(): Promise<Row[]> {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/collections/${slug}`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(200)
    return res.json().items
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    channelId = owner.channel!.id

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    otherCookie = await sessionCookieFor(prisma, other.id)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const created = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie: ownerCookie },
      payload: { name: 'Track order album', slug, style: 'ALBUM', isPublic: true },
    })
    expect(created.statusCode).toBe(201)
    collectionId = created.json().id

    for (const title of ['Alpha', 'Bravo', 'Charlie']) {
      await addItem((await newSound(title)).id)
    }
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { targetId: collectionId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists items in position order with a 1-based trackNumber', async () => {
    const items = await ownerItems()
    expect(items.map((i) => [i.trackNumber, i.position, i.sound?.title])).toEqual([
      [1, 1, 'Alpha'],
      [2, 2, 'Bravo'],
      [3, 3, 'Charlie'],
    ])
  })

  it('renumbers the rest 1..n when a track is removed', async () => {
    const extra = await addItem((await newSound('Delta')).id)
    const items = await ownerItems()
    const bravo = items.find((i) => i.sound?.title === 'Bravo')!
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/me/collections/${slug}/items/${bravo.id}`,
      headers: { cookie: ownerCookie },
    })
    expect(removed.statusCode).toBe(204)
    expect(await storedPositions()).toEqual([
      [1, 'Alpha'],
      [2, 'Charlie'],
      [3, 'Delta'],
    ])
    await prisma.collectionItem.delete({ where: { id: extra.id } })
  })

  it('keeps numbering dense on an insert at the front or past the end', async () => {
    const front = await addItem((await newSound('Opener')).id, 1)
    expect(front.position).toBe(1)
    const tail = await addItem((await newSound('Closer')).id, 99)
    expect(tail.position).toBe(4)
    expect(await storedPositions()).toEqual([
      [1, 'Opener'],
      [2, 'Alpha'],
      [3, 'Charlie'],
      [4, 'Closer'],
    ])
    await prisma.collectionItem.deleteMany({ where: { id: { in: [front.id, tail.id] } } })
    await prisma.$transaction((tx) => compactCollectionPositions(tx, collectionId))
  })

  it('lets the owner reorder, and rejects an incomplete or duplicated list', async () => {
    const [alpha, charlie] = await ownerItems()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/me/collections/${slug}/reorder`,
      headers: { cookie: ownerCookie },
      payload: { itemIds: [charlie!.id, alpha!.id] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().items.map((i: Row) => [i.trackNumber, i.sound?.title])).toEqual([
      [1, 'Charlie'],
      [2, 'Alpha'],
    ])

    const duplicated = await app.inject({
      method: 'PUT',
      url: `/api/me/collections/${slug}/reorder`,
      headers: { cookie: ownerCookie },
      payload: { itemIds: [charlie!.id, charlie!.id] },
    })
    expect(duplicated.statusCode).toBe(400)
    const partial = await app.inject({
      method: 'PUT',
      url: `/api/me/collections/${slug}/reorder`,
      headers: { cookie: ownerCookie },
      payload: { itemIds: [charlie!.id] },
    })
    expect(partial.statusCode).toBe(400)
    expect(await storedPositions()).toEqual([
      [1, 'Charlie'],
      [2, 'Alpha'],
    ])
  })

  it("does not let another artist reorder someone else's album", async () => {
    const [first, second] = await ownerItems()
    const res = await app.inject({
      method: 'PUT',
      url: `/api/me/collections/${slug}/reorder`,
      headers: { cookie: otherCookie },
      payload: { itemIds: [second!.id, first!.id] },
    })
    expect(res.statusCode).toBe(404)
    const admin = await app.inject({
      method: 'PUT',
      url: `/api/admin/collections/${slug}/reorder`,
      headers: { cookie: otherCookie },
      payload: { itemIds: [second!.id, first!.id] },
    })
    expect(admin.statusCode).toBe(403)
    const anonymous = await app.inject({
      method: 'PUT',
      url: `/api/admin/collections/${slug}/reorder`,
      payload: { itemIds: [second!.id, first!.id] },
    })
    expect(anonymous.statusCode).toBe(401)
    expect(await storedPositions()).toEqual([
      [1, 'Charlie'],
      [2, 'Alpha'],
    ])
  })

  it('numbers public tracks by album order, skipping private ones, under any display sort', async () => {
    await addItem((await newSound('Hidden demo', false)).id, 2)
    await addItem((await newSound('Bonus')).id)
    await prisma.collection.update({ where: { id: collectionId }, data: { trackSortMode: 'NAME' } })

    const res = await app.inject({ method: 'GET', url: `/api/v1/collections/${slug}` })
    expect(res.statusCode).toBe(200)
    const rows = res.json().items as Row[]
    expect(rows.map((i) => [i.sound?.title, i.trackNumber])).toEqual([
      ['Alpha', 2],
      ['Bonus', 3],
      ['Charlie', 1],
    ])
    await prisma.collection.update({
      where: { id: collectionId },
      data: { trackSortMode: 'MANUAL' },
    })
  })

  it('lets a board member see every item and reorder any album, with an audit entry', async () => {
    const view = await app.inject({
      method: 'GET',
      url: `/api/admin/collections/${slug}`,
      headers: { cookie: boardCookie },
    })
    expect(view.statusCode).toBe(200)
    const body = view.json()
    expect(body.owner.username).toBe(`${PREFIX}owner`)
    const items = body.items as Row[]
    expect(items.map((i) => [i.trackNumber, i.sound?.title])).toEqual([
      [1, 'Charlie'],
      [2, 'Hidden demo'],
      [3, 'Alpha'],
      [4, 'Bonus'],
    ])

    const reversed = [...items].reverse().map((i) => i.id)
    const res = await app.inject({
      method: 'PUT',
      url: `/api/admin/collections/${slug}/reorder`,
      headers: { cookie: boardCookie },
      payload: { itemIds: reversed },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().items.map((i: Row) => i.id)).toEqual(reversed)
    expect(await storedPositions()).toEqual([
      [1, 'Bonus'],
      [2, 'Alpha'],
      [3, 'Hidden demo'],
      [4, 'Charlie'],
    ])

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'COLLECTION_ADMIN_REORDER', targetId: collectionId },
    })
    expect(audit?.meta).toMatchObject({ slug, itemIds: reversed })

    const missing = await app.inject({
      method: 'PUT',
      url: `/api/admin/collections/${PREFIX}nope/reorder`,
      headers: { cookie: boardCookie },
      payload: { itemIds: reversed },
    })
    expect(missing.statusCode).toBe(404)
  })
})
