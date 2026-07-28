// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { createTestArtist, sessionCookieFor } from '../../test/helpers.js'

const PREFIX = 'admin-news-'

describe('admin news routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let boardDisplayName: string
  let strangerCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      tier: 'ARTIST',
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    boardDisplayName = board.displayName

    const stranger = await createTestArtist(prisma, {
      email: `${PREFIX}stranger@example.com`,
      username: `${PREFIX}stranger`,
      tier: 'ARTIST',
    })
    strangerCookie = await sessionCookieFor(prisma, stranger.id)
  })

  afterAll(async () => {
    await prisma.newsPost.deleteMany({ where: { authorName: boardDisplayName } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('rejects non-board users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/news',
      headers: { cookie: strangerCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('creates a draft (unpublished) post with a byline snapshot', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/news',
      headers: { cookie: boardCookie },
      payload: { headline: 'New RTMP routing', summary: 'A short summary of the change.' },
    })
    expect(res.statusCode).toBe(201)
    const post = res.json() as { id: string; authorName: string; publishedAt: string | null }
    expect(post.authorName).toBe(boardDisplayName)
    expect(post.publishedAt).toBeNull()
  })

  it('creates a published post when publish: true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/news',
      headers: { cookie: boardCookie },
      payload: { headline: 'Beta opens', summary: 'Sign-ups are open.', publish: true },
    })
    expect(res.statusCode).toBe(201)
    const post = res.json() as { publishedAt: string | null }
    expect(post.publishedAt).not.toBeNull()
  })

  it('rejects an empty headline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/news',
      headers: { cookie: boardCookie },
      payload: { headline: '', summary: 'Missing headline' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('lists all posts including drafts for board members', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/news',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const posts = res.json() as Array<{ headline: string }>
    expect(posts.map((p) => p.headline)).toEqual(
      expect.arrayContaining(['New RTMP routing', 'Beta opens']),
    )
  })

  it('publishes a draft via PATCH and unpublishes it again', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/news',
      headers: { cookie: boardCookie },
      payload: { headline: 'Toggle me', summary: 'Publish toggle test' },
    })
    const { id } = created.json() as { id: string }

    const published = await app.inject({
      method: 'PATCH',
      url: `/api/admin/news/${id}`,
      headers: { cookie: boardCookie },
      payload: { publish: true },
    })
    expect(published.statusCode).toBe(200)
    expect((published.json() as { publishedAt: string | null }).publishedAt).not.toBeNull()

    const unpublished = await app.inject({
      method: 'PATCH',
      url: `/api/admin/news/${id}`,
      headers: { cookie: boardCookie },
      payload: { publish: false },
    })
    expect((unpublished.json() as { publishedAt: string | null }).publishedAt).toBeNull()
  })

  it('deletes a post', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/news',
      headers: { cookie: boardCookie },
      payload: { headline: 'Delete me', summary: 'Delete test' },
    })
    const { id } = created.json() as { id: string }

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/admin/news/${id}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)

    const gone = await prisma.newsPost.findUnique({ where: { id } })
    expect(gone).toBeNull()
  })
})
