// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'discussions-notices-'

describe('Discussion reply notices', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let topicId: string
  let replierId: string
  let replierCookie: string
  let followerId: string
  let mutedId: string

  async function reply(body: string) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/discussions/${topicId}/posts`,
      headers: { cookie: replierCookie },
      payload: { body },
    })
    expect(res.statusCode).toBe(201)
  }

  function noticesFor(userId: string) {
    return prisma.notification.findMany({ where: { userId, type: 'DISCUSSION_REPLY' } })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const make = (name: string) =>
      createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
        isMember: true,
      })
    const board = await make('board')
    const replier = await make('replier')
    replierId = replier.id
    replierCookie = await sessionCookieFor(prisma, replier.id)
    followerId = (await make('follower')).id
    mutedId = (await make('muted')).id
    const topic = await prisma.discussionTopic.create({
      data: {
        title: `${PREFIX}topic`,
        body: 'b',
        createdById: board.id,
        participants: {
          create: [
            { userId: board.id },
            { userId: followerId },
            { userId: mutedId, mutedAt: new Date() },
          ],
        },
      },
    })
    topicId = topic.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('tells followers but not the replier or anyone who muted the topic', async () => {
    await reply('First')
    const follower = await noticesFor(followerId)
    expect(follower).toHaveLength(1)
    expect(follower[0]).toMatchObject({
      url: `/governance/discussions/${topicId}`,
      actorUserId: replierId,
    })
    expect(await noticesFor(replierId)).toHaveLength(0)
    expect(await noticesFor(mutedId)).toHaveLength(0)
  })

  it('does not stack a second notice until the first is read', async () => {
    await reply('Second')
    expect(await noticesFor(followerId)).toHaveLength(1)
    await prisma.notification.updateMany({
      where: { userId: followerId, type: 'DISCUSSION_REPLY' },
      data: { readAt: new Date() },
    })
    await reply('Third')
    expect(await noticesFor(followerId)).toHaveLength(2)
  })
})
