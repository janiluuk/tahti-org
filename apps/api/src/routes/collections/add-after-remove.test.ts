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

const PREFIX = 'col-add-after-remove-'

describe('adding to a playlist after tracks were removed', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let guestCookie: string
  let channelId: string

  const sound = (title: string) =>
    prisma.sound.create({ data: { channelId, title, status: 'READY', isPublic: true } })

  async function playlistWithGaps(slug: string, keep: number[]) {
    const col = await prisma.collection.create({
      data: {
        userId: (await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })).userId,
        slug,
        name: slug,
        isPublic: true,
        collaborative: true,
      },
    })
    for (const position of keep) {
      const item = await sound(`${slug} ${position}`)
      await prisma.collectionItem.create({
        data: { collectionId: col.id, soundId: item.id, position },
      })
    }
    return col
  }

  const titles = async (collectionId: string) =>
    (
      await prisma.collectionItem.findMany({
        where: { collectionId },
        orderBy: { position: 'asc' },
        select: { sound: { select: { title: true } } },
      })
    ).map((i) => i.sound?.title)

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
    channelId = owner.channel!.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    guestCookie = await sessionCookieFor(prisma, guest.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lets a guest add to a collaborative playlist that lost a track', async () => {
    const slug = `${PREFIX}guest`
    const col = await playlistWithGaps(slug, [1, 3])
    const added = await sound('Guest pick')

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/collections/${slug}/items`,
      headers: { cookie: guestCookie },
      payload: { soundId: added.id },
    })

    expect(res.statusCode).toBe(201)
    expect(await titles(col.id)).toEqual([`${slug} 1`, `${slug} 3`, 'Guest pick'])
  })

  it('appends the owner’s track after the last one', async () => {
    const slug = `${PREFIX}owner-append`
    const col = await playlistWithGaps(slug, [1, 4, 5])
    const added = await sound('Owner pick')

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${slug}/items`,
      headers: { cookie: ownerCookie },
      payload: { soundId: added.id },
    })

    expect(res.statusCode).toBe(201)
    expect(await titles(col.id)).toEqual([`${slug} 1`, `${slug} 4`, `${slug} 5`, 'Owner pick'])
  })

  it('makes room when the owner inserts at a position', async () => {
    const slug = `${PREFIX}owner-insert`
    const col = await playlistWithGaps(slug, [1, 2, 3])
    const added = await sound('Owner insert')

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${slug}/items`,
      headers: { cookie: ownerCookie },
      payload: { soundId: added.id, position: 1 },
    })

    expect(res.statusCode).toBe(201)
    expect(await titles(col.id)).toEqual(['Owner insert', `${slug} 1`, `${slug} 2`, `${slug} 3`])
  })
})
