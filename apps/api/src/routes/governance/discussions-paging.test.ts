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

const PREFIX = 'discussions-paging-'

describe('Paging long discussion threads', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let topicId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: `${PREFIX}member`,
      isMember: true,
    })
    cookie = await sessionCookieFor(prisma, member.id)
    const topic = await prisma.discussionTopic.create({
      data: { title: `${PREFIX}topic`, body: 'b', createdById: member.id },
    })
    topicId = topic.id
    await prisma.discussionPost.createMany({
      data: Array.from({ length: 105 }, (_, i) => ({
        topicId,
        authorId: member.id,
        body: `Reply ${i + 1}`,
      })),
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('sends the latest 100 replies, oldest first, then the earlier page', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/discussions/${topicId}`,
      headers: { cookie },
    })
    const body = res.json()
    expect(body.posts).toHaveLength(100)
    expect(body.posts[0].body).toBe('Reply 6')
    expect(body.posts[99].body).toBe('Reply 105')
    expect(body.hasEarlierPosts).toBe(true)

    const earlier = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/discussions/${topicId}/posts?before=${body.posts[0].id}`,
      headers: { cookie },
    })
    expect(earlier.statusCode).toBe(200)
    expect(earlier.json().posts.map((p: { body: string }) => p.body)).toEqual([
      'Reply 1',
      'Reply 2',
      'Reply 3',
      'Reply 4',
      'Reply 5',
    ])
    expect(earlier.json().hasEarlierPosts).toBe(false)
  })

  it('rejects a bad cursor and an unknown topic', async () => {
    const bad = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/discussions/${topicId}/posts?before=abc`,
      headers: { cookie },
    })
    expect(bad.statusCode).toBe(400)
    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/discussions/nope/posts?before=1',
      headers: { cookie },
    })
    expect(missing.statusCode).toBe(404)
  })
})
