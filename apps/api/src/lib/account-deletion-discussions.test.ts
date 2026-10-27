// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'
import { prisma } from '@tahti/db'
import { executeAccountDeletion } from './account-deletion.js'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '../test/helpers.js'

const PREFIX = 'deletion-discussions-'
// The deleted account is tombstoned, not removed, and keeps its channel slug,
// so each run needs its own username.
const RUN = Date.now().toString(36)
const log = { info: () => {}, warn: () => {}, error: () => {} } as never

describe('Discussions in the data export and account deletion', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let boardId: string
  let topicId: string
  let postId: bigint

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user-${RUN}`,
      isMember: true,
    })
    userId = user.id
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
    })
    boardId = board.id
    const topic = await prisma.discussionTopic.create({
      data: {
        title: `${PREFIX}topic`,
        body: 'b',
        createdById: board.id,
        participants: { create: { userId, mutedAt: new Date() } },
        posts: { create: { body: 'My reply', authorId: userId } },
      },
      include: { posts: true },
    })
    topicId = topic.id
    postId = topic.posts[0]!.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('exports the member’s replies and followed topics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie: await sessionCookieFor(prisma, userId) },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.discussionPosts).toEqual([
      expect.objectContaining({
        body: 'My reply',
        topic: { id: topicId, title: `${PREFIX}topic` },
      }),
    ])
    expect(body.discussionFollows).toHaveLength(1)
    expect(body.discussionTopicsOpened).toEqual([])
    expect(body.discussionFollows[0].mutedAt).not.toBeNull()
  })

  it('exports the topics a board member opened', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie: await sessionCookieFor(prisma, boardId) },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().discussionTopicsOpened).toEqual([
      expect.objectContaining({ id: topicId, title: `${PREFIX}topic`, status: 'OPEN' }),
    ])
  })

  it('keeps replies as from a deleted account and drops follows on deletion', async () => {
    await executeAccountDeletion(prisma, log, { userId, actorId: boardId })
    const post = await prisma.discussionPost.findUniqueOrThrow({ where: { id: postId } })
    expect(post.authorId).toBeNull()
    expect(await prisma.discussionParticipant.count({ where: { userId } })).toBe(0)
  })
})
