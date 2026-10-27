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

const PREFIX = 'discussions-follow-'

describe('Following and muting discussion topics', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let memberId: string
  let memberCookie: string
  let topicId: string

  function put(path: 'follow' | 'mute', payload: object, id = topicId) {
    return app.inject({
      method: 'PUT',
      url: `/api/v1/governance/discussions/${id}/${path}`,
      headers: { cookie: memberCookie },
      payload,
    })
  }

  function row() {
    return prisma.discussionParticipant.findUnique({
      where: { topicId_userId: { topicId, userId: memberId } },
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: `${PREFIX}member`,
      isMember: true,
    })
    memberId = member.id
    memberCookie = await sessionCookieFor(prisma, member.id)
    const topic = await prisma.discussionTopic.create({
      data: { title: `${PREFIX}topic`, body: 'b', createdById: board.id },
    })
    topicId = topic.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('follows, mutes, unmutes and unfollows', async () => {
    const follow = await put('follow', { following: true })
    expect(follow.json()).toEqual({ following: true, muted: false })
    expect(await row()).not.toBeNull()

    const mute = await put('mute', { muted: true })
    expect(mute.json()).toEqual({ following: true, muted: true })
    expect((await row())?.mutedAt).not.toBeNull()

    const again = await put('follow', { following: true })
    expect(again.json()).toEqual({ following: true, muted: true })

    const unmute = await put('mute', { muted: false })
    expect(unmute.json()).toEqual({ following: true, muted: false })
    expect((await row())?.mutedAt).toBeNull()

    const unfollow = await put('follow', { following: false })
    expect(unfollow.json()).toEqual({ following: false, muted: false })
    expect(await row()).toBeNull()
  })

  it('muting a topic you do not follow follows it muted', async () => {
    const res = await put('mute', { muted: true })
    expect(res.json()).toEqual({ following: true, muted: true })
    await put('follow', { following: false })
  })

  it('rejects bad bodies and unknown topics', async () => {
    expect((await put('mute', { muted: 'yes' })).statusCode).toBe(400)
    expect((await put('follow', { following: true }, 'nope')).statusCode).toBe(404)
  })
})
