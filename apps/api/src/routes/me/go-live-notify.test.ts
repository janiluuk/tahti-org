// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/queue.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/queue.js')>()),
  enqueueWarmSoundFallbackCache: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'go-live-notify-'

describe('going live tells followers', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string
  let channelSlug: string
  let cookie: string
  let followerId: string

  const liveNotes = () =>
    prisma.notification.findMany({
      where: { userId: followerId, type: 'CHANNEL_LIVE' },
      select: { title: true, url: true },
    })

  const goLive = async () => {
    await prisma.broadcast.updateMany({
      where: { channelId, endedAt: null },
      data: { endedAt: new Date() },
    })
    await prisma.channel.update({ where: { id: channelId }, data: { state: 'PREVIEW' } })
    await prisma.broadcast.create({ data: { channelId, source: 'RTMP' } })
    return app.inject({ method: 'POST', url: '/api/me/channel/go-live', headers: { cookie } })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Live Artist',
    })
    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}follower@example.com`,
      username: `${PREFIX}follower`,
    })
    channelId = artist.channel!.id
    channelSlug = artist.channel!.slug
    followerId = follower.id
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.artistFollow.create({
      data: { artistUserId: artist.id, followerUserId: followerId },
    })
  })

  afterAll(async () => {
    await prisma.broadcast.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('notifies followers once, even if the stream restarts soon after', async () => {
    expect((await goLive()).statusCode).toBe(200)
    await vi.waitFor(async () => expect(await liveNotes()).toHaveLength(1))
    expect(await liveNotes()).toEqual([{ title: 'Live Artist is live', url: `/c/${channelSlug}` }])

    expect((await goLive()).statusCode).toBe(200)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(await liveNotes()).toHaveLength(1)
  })
})
