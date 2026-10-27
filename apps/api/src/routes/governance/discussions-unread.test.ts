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

const PREFIX = 'discussions-unread-'

describe('Unread replies in discussion topics', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let readerCookie: string
  let otherCookie: string
  let topicId: string

  async function unreadCount() {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/discussions',
      headers: { cookie: readerCookie },
    })
    return res.json().topics.find((t: { id: string; unreadCount: number }) => t.id === topicId)
      .unreadCount
  }

  function reply(cookie: string, body: string) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/governance/discussions/${topicId}/posts`,
      headers: { cookie },
      payload: { body },
    })
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
    readerCookie = await sessionCookieFor(prisma, (await make('reader')).id)
    otherCookie = await sessionCookieFor(prisma, (await make('other')).id)
    const topic = await prisma.discussionTopic.create({
      data: { title: `${PREFIX}topic`, body: 'b', createdById: board.id },
    })
    topicId = topic.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('counts others’ replies since the follower last opened the topic', async () => {
    expect(await unreadCount()).toBe(0)
    await reply(readerCookie, 'Mine')
    expect(await unreadCount()).toBe(0)

    await reply(otherCookie, 'One')
    await reply(otherCookie, 'Two')
    expect(await unreadCount()).toBe(2)

    await app.inject({
      method: 'GET',
      url: `/api/v1/governance/discussions/${topicId}`,
      headers: { cookie: readerCookie },
    })
    expect(await unreadCount()).toBe(0)

    await reply(otherCookie, 'Three')
    expect(await unreadCount()).toBe(1)
  })
})
