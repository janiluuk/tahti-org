// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'comment-notify-'

describe('comments tell the artist', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let artistCookie: string
  let fanCookie: string
  let slug: string
  let soundId: string

  const notes = () =>
    prisma.notification.findMany({
      where: { userId: artistId, type: 'NEW_COMMENT' },
      orderBy: { createdAt: 'asc' },
      select: { title: true, body: true, url: true },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
      displayName: 'Commenting Fan',
    })
    artistId = artist.id
    slug = artist.channel!.slug
    artistCookie = await sessionCookieFor(prisma, artist.id)
    fanCookie = await sessionCookieFor(prisma, fan.id)
    await prisma.channel.update({
      where: { id: artist.channel!.id },
      data: { commentsEnabled: true },
    })
    soundId = (
      await prisma.sound.create({
        data: {
          channelId: artist.channel!.id,
          title: 'Drift',
          status: 'READY',
          isPublic: true,
          commentsEnabled: true,
        },
      })
    ).id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('notifies about comments on a track and the channel, not your own', async () => {
    const post = (url: string, cookie: string, body: string) =>
      app.inject({ method: 'POST', url, headers: { cookie }, payload: { body } })

    expect((await post(`/api/comments/track/${soundId}`, fanCookie, 'Lovely set')).statusCode).toBe(
      201,
    )
    expect(
      (await post(`/api/comments/channel/${slug}`, fanCookie, 'Great channel')).statusCode,
    ).toBe(201)
    expect((await post(`/api/comments/track/${soundId}`, artistCookie, 'Thanks!')).statusCode).toBe(
      201,
    )

    expect(await notes()).toEqual([
      { title: 'Commenting Fan commented on "Drift"', body: 'Lovely set', url: `/t/${soundId}` },
      {
        title: 'Commenting Fan commented on your channel',
        body: 'Great channel',
        url: `/c/${slug}`,
      },
    ])
  })
})
