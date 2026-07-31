// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/get'),
}))

import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'new-to-you-'

describe('/api/discover/new-to-you', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let listenerCookie: string
  let heardId: string
  let genreMatchId: string
  let followedMatchId: string
  let otherId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: `${PREFIX}listener`,
      displayName: 'Listener',
    })
    listenerCookie = await sessionCookieFor(prisma, listener.id)

    const technoArtist = await createTestArtist(prisma, {
      email: `${PREFIX}techno@example.com`,
      username: `${PREFIX}techno`,
      displayName: 'Techno Artist',
    })
    await prisma.user.update({
      where: { id: technoArtist.id },
      data: { socialLinks: { genres: 'Techno' } },
    })

    const followed = await createTestArtist(prisma, {
      email: `${PREFIX}followed@example.com`,
      username: `${PREFIX}followed`,
      displayName: 'Followed Artist',
    })

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
      displayName: 'Other Artist',
    })

    const seedListen = await prisma.archiveItem.create({
      data: {
        channelId: technoArtist.channel!.id,
        title: 'Seed techno listen',
        genre: 'Techno',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}seed.mp3`,
        releasedAt: new Date('2024-01-01'),
      },
    })
    await prisma.listenEvent.create({
      data: {
        archiveItemId: seedListen.id,
        dedupeKey: `user:${listener.id}`,
        dayBucket: '2024-01-01',
      },
    })
    heardId = seedListen.id

    const genreMatch = await prisma.archiveItem.create({
      data: {
        channelId: technoArtist.channel!.id,
        title: 'Unheard techno',
        genre: 'Techno',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}genre.mp3`,
        releasedAt: new Date('2025-06-01'),
      },
    })
    genreMatchId = genreMatch.id

    const followedTrack = await prisma.archiveItem.create({
      data: {
        channelId: followed.channel!.id,
        title: 'From followed',
        genre: 'Ambient',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}followed.mp3`,
        releasedAt: new Date('2025-05-01'),
      },
    })
    followedMatchId = followedTrack.id
    await prisma.artistFollow.create({
      data: { followerUserId: listener.id, artistUserId: followed.id },
    })

    const otherTrack = await prisma.archiveItem.create({
      data: {
        channelId: other.channel!.id,
        title: 'Unrelated folk',
        genre: 'Folk',
        status: 'READY',
        isPublic: true,
        mp3Key: `${PREFIX}other.mp3`,
        releasedAt: new Date('2025-07-01'),
      },
    })
    otherId = otherTrack.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns empty for anonymous visitors', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/discover/new-to-you' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ authenticated: false, preferenceGenres: [], items: [] })
  })

  it('excludes heard tracks and prefers followed + genre matches', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/discover/new-to-you',
      headers: { cookie: listenerCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      authenticated: boolean
      preferenceGenres: string[]
      items: Array<{ archiveItemId: string; title: string }>
    }
    expect(body.authenticated).toBe(true)
    expect(body.preferenceGenres.map((g) => g.toLowerCase())).toContain('techno')

    const ids = body.items.map((i) => i.archiveItemId)
    expect(ids).not.toContain(heardId)
    expect(ids).toContain(genreMatchId)
    expect(ids).toContain(followedMatchId)

    // Followed (+100) and genre (+50) should outrank a newer unrelated track
    expect(ids.indexOf(followedMatchId)).toBeLessThan(ids.indexOf(otherId))
    expect(ids.indexOf(genreMatchId)).toBeLessThan(ids.indexOf(otherId))
  })
})
