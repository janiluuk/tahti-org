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

const PREFIX = 'admin-streams-artwork-'

describe('GET /api/admin/streams — who is live', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-streams-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98741,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const live = await createTestArtist(prisma, {
      email: `${PREFIX}live@example.com`,
      username: 'admin-streams-live',
    })
    await prisma.user.update({
      where: { id: live.id },
      data: { avatarUrl: 'https://cdn.example.com/live.png', displayName: 'live@example.com' },
    })
    await prisma.channel.update({
      where: { id: live.channel!.id },
      data: { state: 'LIVE', goneLiveAt: new Date() },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it("returns the artist's avatar and never an email as the name", async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/streams',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const row = res.json().streams.find((s: { slug: string }) => s.slug === 'admin-streams-live')
    expect(row).toMatchObject({
      avatarUrl: 'https://cdn.example.com/live.png',
      artistName: 'admin-streams-live',
    })
  })
})
