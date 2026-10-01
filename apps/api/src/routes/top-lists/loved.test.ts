// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'loved-list-test-'

describe('GET /api/top-lists/loved', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let favouriteId: string
  let likedId: string
  let privateId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Loved List Artist',
    })
    const fans = await Promise.all(
      [1, 2, 3].map((n) =>
        createTestArtist(prisma, {
          email: `${PREFIX}fan${n}@example.com`,
          username: `${PREFIX}fan${n}`,
        }),
      ),
    )
    const track = (title: string, isPublic = true) =>
      prisma.sound.create({
        data: {
          channelId: artist.channel!.id,
          title,
          status: 'READY',
          isPublic,
          genre: 'Loved Test Genre',
        },
      })
    const favourite = await track('Loved favourite')
    const liked = await track('Loved once')
    const hidden = await track('Loved private', false)
    favouriteId = favourite.id
    likedId = liked.id
    privateId = hidden.id

    const love = (soundId: string, userId: string, positionSec: number) =>
      prisma.trackReaction.create({ data: { soundId, userId, type: 'LOVE', positionSec } })
    await love(favouriteId, fans[0]!.id, 1)
    await love(favouriteId, fans[1]!.id, 2)
    await love(likedId, fans[2]!.id, 3)
    await love(likedId, fans[2]!.id, 30)
    await love(likedId, fans[2]!.id, 60)
    await love(privateId, fans[0]!.id, 4)
    await prisma.trackReaction.create({
      data: { soundId: likedId, userId: fans[0]!.id, type: 'LAUGH', positionSec: 5 },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('ranks public tracks by how many people loved them', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/top-lists/loved?genre=Loved%20Test%20Genre',
    })
    expect(res.statusCode).toBe(200)
    const entries = res.json().entries as Array<{
      soundId: string
      loves: number
      artistName: string
    }>
    expect(entries.map((e) => e.soundId)).toEqual([favouriteId, likedId])
    expect(entries.map((e) => e.loves)).toEqual([2, 1])
    expect(entries[0]!.artistName).toBe('Loved List Artist')
  })

  it('rejects unknown content types', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/top-lists/loved?contentTypes=NOPE' })
    expect(res.statusCode).toBe(400)
  })
})
