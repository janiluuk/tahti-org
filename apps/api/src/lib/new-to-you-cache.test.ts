// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { store, redisState, presign } = vi.hoisted(() => ({
  store: new Map<string, string>(),
  redisState: { down: false },
  presign: vi.fn(),
}))

vi.mock('./minio.js', () => ({ presignedGetUrl: presign }))

vi.mock('./redis.js', () => {
  const client = {
    get: vi.fn(async (key: string) => {
      if (redisState.down) throw new Error('redis down')
      return store.get(key) ?? null
    }),
    set: vi.fn(async (key: string, value: string) => {
      if (redisState.down) throw new Error('redis down')
      store.set(key, value)
      return 'OK'
    }),
  }
  return {
    getRedisClient: vi.fn(async () => client),
    getOptionalRedisClient: vi.fn(async () => client),
    noteRedisFailure: vi.fn(),
  }
})

import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'
import { buildNewToYou } from './new-to-you.js'

const PREFIX = 'new-to-you-cache-'

describe('buildNewToYou caching', () => {
  let listenerId: string
  let channelId: string
  let unheardId: string
  let presignCount = 0

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: `${PREFIX}listener`,
    })
    listenerId = listener.id
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    channelId = artist.channel!.id
    const [heard, unheard] = await Promise.all(
      ['heard', 'unheard'].map((title, i) =>
        prisma.sound.create({
          data: {
            channelId,
            title: `${PREFIX}${title}`,
            genre: 'Techno',
            status: 'READY',
            isPublic: true,
            mp3Key: `${PREFIX}${title}.mp3`,
            releasedAt: new Date(Date.UTC(2099, 0, 1 + i)),
          },
        }),
      ),
    )
    unheardId = unheard!.id
    await prisma.listenEvent.createMany({
      data: [1, 2].map((day) => ({
        soundId: heard!.id,
        dedupeKey: `user:${listenerId}`,
        dayBucket: `2026-11-0${day}`,
      })),
    })
  })

  beforeEach(() => {
    store.clear()
    redisState.down = false
    presign.mockImplementation(async () => `https://minio.test/get?n=${++presignCount}`)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('reuses the picks per user but resolves playback links on every call', async () => {
    const first = await buildNewToYou(prisma, listenerId)
    const ids = first.items.map((i) => i.soundId)
    expect(ids).toContain(unheardId)
    expect(ids.filter((id) => id === unheardId)).toHaveLength(1)
    expect([...store.keys()]).toEqual([`discover:new-to-you:v1:${listenerId}:24`])

    await prisma.listenEvent.create({
      data: { soundId: unheardId, dedupeKey: `user:${listenerId}`, dayBucket: '2026-11-03' },
    })
    const second = await buildNewToYou(prisma, listenerId)
    expect(second.preferenceGenres).toEqual(first.preferenceGenres)
    expect(second.items.map((i) => i.soundId)).toEqual(ids)
    expect(second.items.map(({ audioUrl: _url, ...rest }) => rest)).toEqual(
      first.items.map(({ audioUrl: _url, ...rest }) => rest),
    )
    expect(second.items[0]!.audioUrl).not.toBe(first.items[0]!.audioUrl)

    store.clear()
    const fresh = await buildNewToYou(prisma, listenerId)
    expect(fresh.items.map((i) => i.soundId)).not.toContain(unheardId)
    await prisma.listenEvent.deleteMany({
      where: { soundId: unheardId, dedupeKey: `user:${listenerId}` },
    })
  })

  it('falls through to the database when Redis is down', async () => {
    redisState.down = true
    const result = await buildNewToYou(prisma, listenerId)
    expect(result.items.map((i) => i.soundId)).toContain(unheardId)
    expect(store.size).toBe(0)
  })
})
