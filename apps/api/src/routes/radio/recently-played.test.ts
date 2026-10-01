// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn(async (key: string) => `https://minio.test/${key}`),
}))

import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'radio-recent-test-'

describe('GET /api/v1/radio/recently-played', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let publicId: string
  let privateId: string
  let subscribersId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const staleRadio = await prisma.user.findUnique({ where: { username: TAHTI_RADIO_SLUG } })
    if (staleRadio) {
      const emailPrefix = staleRadio.email.slice(0, staleRadio.email.indexOf('@') + 1)
      await cleanupUsersByEmailPrefix(prisma, emailPrefix)
    }

    const radio = await createTestArtist(prisma, {
      email: `${PREFIX}radio@example.com`,
      username: TAHTI_RADIO_SLUG,
      displayName: 'Tahti Radio',
    })
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
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
    publicId = (await track('recent-public')).id
    privateId = (await track('recent-private', { isPublic: false })).id
    subscribersId = (await track('recent-subscribers', { accessMode: 'SUBSCRIBERS_ONLY' })).id

    const base = Date.UTC(2026, 9, 1, 12, 0)
    await prisma.radioPlayLog.createMany({
      data: [
        { soundId: publicId, title: 'Public', minutesAgo: 1 },
        { soundId: privateId, title: 'Private', minutesAgo: 2 },
        { soundId: subscribersId, title: 'Subscribers', minutesAgo: 3 },
        { soundId: null, title: 'Live set', minutesAgo: 4 },
      ].map(({ minutesAgo, ...row }) => ({
        ...row,
        channelId: radio.channel!.id,
        artistName: 'Recent Artist',
        playedAt: new Date(base - minutesAgo * 60_000),
      })),
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('offers a replay link only for tracks the listener may still play', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/radio/recently-played' })
    expect(res.statusCode).toBe(200)
    const rows = res.json() as Array<{
      title: string
      soundId: string | null
      audioUrl: string | null
    }>
    expect(rows.map((r) => [r.title, r.soundId, r.audioUrl])).toEqual([
      ['Public', publicId, 'https://minio.test/mp3/recent-public.mp3'],
      ['Private', null, null],
      ['Subscribers', subscribersId, null],
      ['Live set', null, null],
    ])
  })
})
