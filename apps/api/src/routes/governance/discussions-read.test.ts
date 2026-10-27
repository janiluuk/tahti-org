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

const PREFIX = 'discussions-read-'

describe('Members read discussion topics', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let memberCookie: string
  let outsiderCookie: string
  let pinnedId: string
  let otherId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      displayName: 'Board Aino',
      isBoard: true,
      isMember: true,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: `${PREFIX}member`,
      isMember: true,
    })
    memberCookie = await sessionCookieFor(prisma, member.id)
    const outsider = await createTestArtist(prisma, {
      email: `${PREFIX}outsider@example.com`,
      username: `${PREFIX}outsider`,
    })
    outsiderCookie = await sessionCookieFor(prisma, outsider.id)
    const other = await prisma.discussionTopic.create({
      data: { title: `${PREFIX}older`, body: 'b', createdById: board.id },
    })
    otherId = other.id
    const pinned = await prisma.discussionTopic.create({
      data: {
        title: `${PREFIX}pinned`,
        body: 'Read me',
        createdById: board.id,
        pinned: true,
        lastPostAt: new Date(Date.now() - 86_400_000),
        participants: { create: { userId: member.id, mutedAt: new Date() } },
        posts: { create: { body: 'First reply', authorId: member.id } },
      },
    })
    pinnedId = pinned.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists pinned topics first with the caller’s follow and mute state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/discussions',
      headers: { cookie: memberCookie },
    })
    expect(res.statusCode).toBe(200)
    const mine = res.json().topics.filter((t: { title: string }) => t.title.startsWith(PREFIX))
    expect(mine.map((t: { id: string }) => t.id)).toEqual([pinnedId, otherId])
    expect(mine[0]).toMatchObject({
      following: true,
      muted: true,
      postCount: 1,
      createdBy: 'Board Aino',
    })
    expect(mine[1]).toMatchObject({ following: false, muted: false })
  })

  it('reads one topic with its posts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/discussions/${pinnedId}`,
      headers: { cookie: memberCookie },
    })
    expect(res.json()).toMatchObject({
      title: `${PREFIX}pinned`,
      posts: [expect.objectContaining({ body: 'First reply' })],
    })
  })

  it('is for members only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/discussions',
      headers: { cookie: outsiderCookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
