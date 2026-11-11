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

const PREFIX = 'collection-sort-dir-'

describe('public collection order follows the stored direction', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  const slug = `${PREFIX}mixes`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    const older = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Older set',
        status: 'READY',
        isPublic: true,
        mp3Key: `mp3/${PREFIX}older.mp3`,
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    })
    const newer = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Newer set',
        status: 'READY',
        isPublic: true,
        mp3Key: `mp3/${PREFIX}newer.mp3`,
        createdAt: new Date('2024-06-01T00:00:00.000Z'),
      },
    })

    const created = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie },
      payload: { name: 'Sort direction mixes', slug, isPublic: true },
    })
    expect(created.statusCode).toBe(201)

    for (const [soundId, position] of [
      [older.id, 1],
      [newer.id, 2],
    ] as const) {
      const added = await app.inject({
        method: 'POST',
        url: `/api/me/collections/${slug}/items`,
        headers: { cookie },
        payload: { soundId, position },
      })
      expect(added.statusCode).toBe(201)
    }
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  async function titles() {
    const res = await app.inject({ method: 'GET', url: `/api/v1/collections/${slug}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      items: Array<{ sound: { title: string } | null }>
    }
    return body.items.map((item) => item.sound?.title)
  }

  it('lists newest first when the collection is TIME_DESC', async () => {
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/me/collections/${slug}`,
      headers: { cookie },
      payload: { trackSortMode: 'TIME_DESC' },
    })
    expect(patched.statusCode).toBe(200)
    expect(await titles()).toEqual(['Newer set', 'Older set'])
  })

  it('lists Z–A when the collection is NAME_DESC', async () => {
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/me/collections/${slug}`,
      headers: { cookie },
      payload: { trackSortMode: 'NAME_DESC' },
    })
    expect(patched.statusCode).toBe(200)
    expect(await titles()).toEqual(['Older set', 'Newer set'])
  })
})
