// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/get'),
}))

import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'latest-tracks-'

describe('/api/discover/latest-tracks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let newestId: string
  let olderId: string
  let unlistedId: string
  let differentGenreId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Latest Tracks Artist',
    })

    const older = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Older track',
        genre: 'Techno',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}older.mp3`,
        releasedAt: new Date('2025-01-01'),
      },
    })
    olderId = older.id

    const newest = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Newest track',
        genre: 'Techno',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}newest.mp3`,
        releasedAt: new Date('2025-06-01'),
      },
    })
    newestId = newest.id

    const unlisted = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Private track',
        genre: 'Techno',
        status: 'READY',
        isPublic: false,
        mp3Key: `${PREFIX}private.mp3`,
        releasedAt: new Date('2025-07-01'),
      },
    })
    unlistedId = unlisted.id

    const otherGenre = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Ambient track',
        genre: 'Ambient',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}ambient.mp3`,
        releasedAt: new Date('2025-08-01'),
      },
    })
    differentGenreId = otherGenre.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists public ready tracks newest-first, excluding unlisted ones', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/discover/latest-tracks' })
    expect(res.statusCode).toBe(200)
    const ids = res.json().items.map((i: { soundId: string }) => i.soundId)
    expect(ids).not.toContain(unlistedId)
    expect(ids.indexOf(differentGenreId)).toBeLessThan(ids.indexOf(newestId))
    expect(ids.indexOf(newestId)).toBeLessThan(ids.indexOf(olderId))
  })

  it('filters by genre', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/discover/latest-tracks?genre=Ambient',
    })
    expect(res.statusCode).toBe(200)
    const ids = res.json().items.map((i: { soundId: string }) => i.soundId)
    expect(ids).toEqual([differentGenreId])
  })

  it('returns 400 for an invalid contentTypes value', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/discover/latest-tracks?contentTypes=NONSENSE',
    })
    expect(res.statusCode).toBe(400)
  })

  it('caps limit to the maximum', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/discover/latest-tracks?limit=999',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().items.length).toBeLessThanOrEqual(50)
  })
})
