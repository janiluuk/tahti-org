// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { SearchResponseSchema } from '@tahti/shared'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'search-playback-'
const WORD = 'Zyxplaybackword'

describe('GET /api/v1/search track playback', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const base = {
      channelId: artist.channel!.id,
      status: 'READY' as const,
      isPublic: true,
    }
    await prisma.sound.createMany({
      data: [
        { ...base, title: `${WORD} free`, mp3Key: `mp3/${PREFIX}free.mp3` },
        {
          ...base,
          title: `${WORD} members`,
          mp3Key: `mp3/${PREFIX}members.mp3`,
          accessMode: 'SUBSCRIBERS_ONLY',
        },
        {
          ...base,
          title: `${WORD} embed`,
          embedProvider: 'HEARTHIS',
          embedUri: '1234567',
        },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('gives free tracks a stream, gated tracks a gate and embeds their widget', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/search?q=${WORD}&type=tracks` })
    expect(res.statusCode).toBe(200)
    const { tracks } = SearchResponseSchema.parse(res.json())
    const byTitle = new Map(tracks.map((t) => [t.title, t]))
    expect(byTitle.get(`${WORD} free`)?.audioUrl).toBeTruthy()
    expect(byTitle.get(`${WORD} free`)?.artistUsername).toBe(`${PREFIX}artist`)
    expect(byTitle.get(`${WORD} members`)?.audioUrl).toBeNull()
    expect(byTitle.get(`${WORD} members`)?.gate?.reason).toBe('SUBSCRIBERS_ONLY')
    expect(byTitle.get(`${WORD} embed`)).toMatchObject({
      audioUrl: null,
      embedProvider: 'HEARTHIS',
      embedUri: '1234567',
    })
  })
})
