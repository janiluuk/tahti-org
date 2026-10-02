// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn(async (key: string) => `https://minio.test/${key}`),
}))

import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'user-likes-test-'

describe('GET /api/v1/u/:username/likes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let olderId: string
  let newerId: string
  let gatedId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Liked Artist',
    })
    const banned = await createTestArtist(prisma, {
      email: `${PREFIX}banned@example.com`,
      username: `${PREFIX}banned`,
    })
    await prisma.user.update({ where: { id: banned.id }, data: { suspendedAt: new Date() } })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    const shy = await createTestArtist(prisma, {
      email: `${PREFIX}shy@example.com`,
      username: `${PREFIX}shy`,
    })
    await prisma.user.update({ where: { id: shy.id }, data: { showLikes: false } })

    const track = (channelId: string, title: string, data: Record<string, unknown> = {}) =>
      prisma.sound.create({
        data: {
          channelId,
          title,
          status: 'READY',
          isPublic: true,
          mp3Key: `mp3/${title}.mp3`,
          bannerUrl: `https://img.test/${title}.jpg`,
          ...data,
        },
      })
    olderId = (await track(artist.channel!.id, 'pl-older')).id
    newerId = (await track(artist.channel!.id, 'pl-newer')).id
    gatedId = (await track(artist.channel!.id, 'pl-gated', { accessMode: 'SUBSCRIBERS_ONLY' })).id
    const privateId = (await track(artist.channel!.id, 'pl-private', { isPublic: false })).id
    const draftId = (await track(artist.channel!.id, 'pl-draft', { status: 'PENDING' })).id
    const bannedId = (await track(banned.channel!.id, 'pl-banned')).id

    const base = Date.UTC(2026, 9, 1, 12, 0)
    const likes = [
      { soundId: olderId, minutesAgo: 30 },
      { soundId: gatedId, minutesAgo: 20 },
      { soundId: privateId, minutesAgo: 15 },
      { soundId: draftId, minutesAgo: 14 },
      { soundId: bannedId, minutesAgo: 12 },
      { soundId: newerId, minutesAgo: 10 },
    ]
    await prisma.soundLike.createMany({
      data: [fan.id, shy.id].flatMap((userId) =>
        likes.map(({ soundId, minutesAgo }) => ({
          userId,
          soundId,
          createdAt: new Date(base - minutesAgo * 60_000),
        })),
      ),
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists public tracks by listed artists, newest first, gating the audio', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/u/${PREFIX}fan/likes` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      owner: { username: string; displayName: string }
      showLikes: boolean
      itemCount: number
      coverUrl: string | null
      items: Array<{ id: string; artistDisplayName: string; audioUrl: string | null }>
    }
    expect(body.showLikes).toBe(true)
    expect(body.owner.username).toBe(`${PREFIX}fan`)
    expect(body.items.map((i) => i.id)).toEqual([newerId, gatedId, olderId])
    expect(body.itemCount).toBe(3)
    expect(body.coverUrl).toBe('https://img.test/pl-newer.jpg')
    expect(body.items[0]!.artistDisplayName).toBe('Liked Artist')
    expect(body.items[0]!.audioUrl).toBe('https://minio.test/mp3/pl-newer.mp3')
    expect(body.items[1]!.audioUrl).toBeNull()
  })

  it('honours ?limit while counting every visible like', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/u/${PREFIX}fan/likes?limit=1` })
    expect(res.json().items.map((i: { id: string }) => i.id)).toEqual([newerId])
    expect(res.json().itemCount).toBe(3)
    const bad = await app.inject({ method: 'GET', url: `/api/v1/u/${PREFIX}fan/likes?limit=0` })
    expect(bad.statusCode).toBe(400)
  })

  it('returns no items and showLikes: false when the user keeps likes private', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/u/${PREFIX}shy/likes` })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      showLikes: false,
      itemCount: 0,
      coverUrl: null,
      items: [],
    })
  })

  it('404s for an unknown or suspended user', async () => {
    const unknown = await app.inject({ method: 'GET', url: '/api/v1/u/no-such-user-x/likes' })
    expect(unknown.statusCode).toBe(404)
    const banned = await app.inject({ method: 'GET', url: `/api/v1/u/${PREFIX}banned/likes` })
    expect(banned.statusCode).toBe(404)
  })
})
