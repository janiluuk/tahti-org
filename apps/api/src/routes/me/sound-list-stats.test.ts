// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-list-stats-'

describe('GET /api/me/sound — public totals per track', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let soundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    soundId = (await createReadySound(prisma, artist.channel!.id, 'Counted')).id
    await prisma.listenEvent.createMany({
      data: [
        { soundId, dedupeKey: 'a', dayBucket: '2026-10-01' },
        { soundId, dedupeKey: 'b', dayBucket: '2026-10-01' },
      ],
    })
    await prisma.soundLike.create({ data: { soundId, userId: artist.id } })
    await prisma.download.create({
      data: {
        channelId: artist.channel!.id,
        soundId,
        format: 'mp3',
        byFingerprint: 'f',
        byIpHash: 'i',
        countedAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns likes, plays and counted downloads with each sound', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/sound', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const item = res.json().find((s: { id: string }) => s.id === soundId)
    expect(item).toMatchObject({
      likeCount: 1,
      playCount: 2,
      downloadCount: 1,
      commentCount: 0,
    })
    expect(item._count).toBeUndefined()
  })
})
