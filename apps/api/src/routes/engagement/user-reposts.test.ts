// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'user-reposts-'

describe('GET /api/v1/u/:username/reposts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'user-reposts-artist',
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: 'user-reposts-fan',
    })
    const channelId = (
      await prisma.channel.findUniqueOrThrow({ where: { userId: artist.id }, select: { id: true } })
    ).id
    const older = await createReadySound(prisma, channelId, 'Older repost')
    const newer = await createReadySound(prisma, channelId, 'Newer repost')
    const hidden = await createReadySound(prisma, channelId, 'Made private')
    await prisma.sound.update({ where: { id: hidden.id }, data: { isPublic: false } })

    await prisma.soundRepost.createMany({
      data: [
        { userId: fan.id, soundId: older.id, createdAt: new Date('2026-01-01') },
        { userId: fan.id, soundId: newer.id, createdAt: new Date('2026-02-01') },
        { userId: fan.id, soundId: hidden.id, createdAt: new Date('2026-03-01') },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it("lists a user's public reposts, newest first, with the original artist", async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/u/user-reposts-fan/reposts' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      items: Array<{
        title: string
        artistUsername: string
        channelSlug: string
        repostedAt: string
        url: string
      }>
    }
    expect(body.items.map((i) => i.title)).toEqual(['Newer repost', 'Older repost'])
    expect(body.items[0]!.artistUsername).toBe('user-reposts-artist')
    expect(body.items[0]!.repostedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(body.items[0]!.url).toContain('sound-item-')
  })

  it('returns an empty list for someone who reposted nothing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/u/user-reposts-artist/reposts' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ items: [] })
  })

  it('404s for an unknown user', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/u/no-such-user-x/reposts' })
    expect(res.statusCode).toBe(404)
  })
})
