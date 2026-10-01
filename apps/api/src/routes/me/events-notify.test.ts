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

const PREFIX = 'events-notify-'

describe('new events tell followers', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let followerId: string

  const eventNotes = () =>
    prisma.notification.findMany({
      where: { userId: followerId, type: 'NEW_EVENT' },
      select: { title: true, body: true, url: true },
    })

  const addEvent = (title: string, startAt: Date) =>
    app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title,
        place: 'Tavastia',
        location: 'Helsinki',
        startAt: startAt.toISOString(),
      },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Event Artist',
    })
    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}follower@example.com`,
      username: `${PREFIX}follower`,
    })
    followerId = follower.id
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.artistFollow.create({
      data: { artistUserId: artist.id, followerUserId: follower.id },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('notifies followers about an upcoming event, not a past one', async () => {
    const past = await addEvent('Last year', new Date(Date.now() - 86_400_000))
    expect(past.statusCode).toBe(201)
    expect(await eventNotes()).toEqual([])

    const upcoming = await addEvent('Album release', new Date(Date.now() + 7 * 86_400_000))
    expect(upcoming.statusCode).toBe(201)
    expect(await eventNotes()).toEqual([
      {
        title: 'Event Artist announced an event',
        body: 'Album release · Tavastia, Helsinki',
        url: `/u/${PREFIX}artist`,
      },
    ])
  })
})
