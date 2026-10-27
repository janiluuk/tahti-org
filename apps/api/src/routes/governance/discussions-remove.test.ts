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

const PREFIX = 'discussions-remove-'

describe('Removing discussion replies', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let authorId: string
  let authorCookie: string
  let otherCookie: string
  let topicId: string

  async function post(body: string) {
    const row = await prisma.discussionPost.create({
      data: { topicId, authorId, body },
    })
    return row.id.toString()
  }

  function remove(postId: string, cookie: string) {
    return app.inject({
      method: 'DELETE',
      url: `/api/v1/governance/discussions/${topicId}/posts/${postId}`,
      headers: { cookie },
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const make = (name: string, isBoard = false) =>
      createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
        isMember: true,
        isBoard,
      })
    const board = await make('board', true)
    boardCookie = await sessionCookieFor(prisma, board.id)
    const author = await make('author')
    authorId = author.id
    authorCookie = await sessionCookieFor(prisma, author.id)
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

  it('the author removes their own reply and it is audited', async () => {
    const id = await post('Oops')
    const res = await remove(id, authorCookie)
    expect(res.statusCode).toBe(200)
    expect(await prisma.discussionPost.findUnique({ where: { id: BigInt(id) } })).toBeNull()
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'DISCUSSION_POST_REMOVE', targetId: topicId },
    })
    expect(audit?.meta).toMatchObject({ postId: id, byAuthor: true })
  })

  it('another member cannot remove it', async () => {
    const id = await post('Mine')
    expect((await remove(id, otherCookie)).statusCode).toBe(403)
  })

  it('once closed only the board can remove a reply', async () => {
    const id = await post('Kept')
    await prisma.discussionTopic.update({ where: { id: topicId }, data: { status: 'CLOSED' } })
    expect((await remove(id, authorCookie)).statusCode).toBe(409)
    expect((await remove(id, boardCookie)).statusCode).toBe(200)
  })

  it('the author edits their reply while the topic is open; it is marked edited', async () => {
    await prisma.discussionTopic.update({ where: { id: topicId }, data: { status: 'OPEN' } })
    const id = await post('Typo')
    const edit = (cookie: string, body: string) =>
      app.inject({
        method: 'PATCH',
        url: `/api/v1/governance/discussions/${topicId}/posts/${id}`,
        headers: { cookie },
        payload: { body },
      })
    expect((await edit(otherCookie, 'Hijack')).statusCode).toBe(403)
    const res = await edit(authorCookie, '  Fixed  ')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ body: 'Fixed', mine: true })
    expect(res.json().editedAt).toEqual(expect.any(String))
    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/governance/discussions/${topicId}`,
      headers: { cookie: authorCookie },
    })
    expect(read.json().posts.find((p: { id: string }) => p.id === id)).toMatchObject({
      body: 'Fixed',
      editedAt: expect.any(String),
    })
    await prisma.discussionTopic.update({ where: { id: topicId }, data: { status: 'CLOSED' } })
    expect((await edit(authorCookie, 'Late')).statusCode).toBe(409)
  })

  it('404s an unknown reply', async () => {
    expect((await remove('999999999', boardCookie)).statusCode).toBe(404)
  })
})
