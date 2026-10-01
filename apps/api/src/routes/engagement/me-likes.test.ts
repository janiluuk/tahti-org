// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn(async (key: string) => `https://minio.test/${key}`),
}))

import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'me-likes-test-'

describe('GET /api/me/likes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let olderId: string
  let newerId: string
  let gatedId: string
  let privateId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Liked Artist',
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    cookie = await sessionCookieFor(prisma, fan.id)

    const track = (title: string, data: Record<string, unknown> = {}) =>
      prisma.sound.create({
        data: {
          channelId: artist.channel!.id,
          title,
          status: 'READY',
          isPublic: true,
          mp3Key: `mp3/${title}.mp3`,
          ...data,
        },
      })
    olderId = (await track('liked-older')).id
    newerId = (await track('liked-newer')).id
    gatedId = (await track('liked-gated', { accessMode: 'SUBSCRIBERS_ONLY' })).id
    privateId = (await track('liked-private', { isPublic: false })).id

    const base = Date.UTC(2026, 9, 1, 12, 0)
    await prisma.soundLike.createMany({
      data: [
        { soundId: olderId, minutesAgo: 30 },
        { soundId: gatedId, minutesAgo: 20 },
        { soundId: privateId, minutesAgo: 15 },
        { soundId: newerId, minutesAgo: 10 },
      ].map(({ soundId, minutesAgo }) => ({
        userId: fan.id,
        soundId,
        createdAt: new Date(base - minutesAgo * 60_000),
      })),
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/likes' })
    expect(res.statusCode).toBe(401)
  })

  it('lists your liked public tracks newest first, gating the audio', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/likes', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const items = res.json().items as Array<{
      id: string
      artistDisplayName: string
      audioUrl: string | null
    }>
    expect(items.map((i) => i.id)).toEqual([newerId, gatedId, olderId])
    expect(items[0]!.artistDisplayName).toBe('Liked Artist')
    expect(items[0]!.audioUrl).toBe('https://minio.test/mp3/liked-newer.mp3')
    expect(items[1]!.audioUrl).toBeNull()
  })

  it('honours ?limit and rejects a bad one', async () => {
    const one = await app.inject({
      method: 'GET',
      url: '/api/me/likes?limit=1',
      headers: { cookie },
    })
    expect(one.json().items.map((i: { id: string }) => i.id)).toEqual([newerId])
    const bad = await app.inject({
      method: 'GET',
      url: '/api/me/likes?limit=0',
      headers: { cookie },
    })
    expect(bad.statusCode).toBe(400)
  })
})
