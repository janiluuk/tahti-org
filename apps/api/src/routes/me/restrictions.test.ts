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

const PREFIX = 'me-restrictions-'

describe('GET /api/me/restrictions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let cookie: string
  const until = new Date(Date.now() + 7 * 86_400_000)

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
    })
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.accountRestriction.createMany({
      data: [
        {
          userId,
          type: 'UPLOAD',
          reason: 'Copyright strikes',
          expiresAt: until,
          bannedById: board.id,
        },
        { userId, type: 'LIVE_SHOW_BOOKING', reason: 'Lifted', liftedAt: new Date() },
        {
          userId,
          type: 'LIVE_SHOW_BOOKING',
          reason: 'Expired',
          expiresAt: new Date(Date.now() - 1000),
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.accountRestriction.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists only active restrictions, without who issued them', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/restrictions',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      restrictions: [
        { type: 'UPLOAD', reason: 'Copyright strikes', expiresAt: until.toISOString() },
      ],
    })
  })

  it('needs a signed-in caller', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/restrictions' })
    expect(res.statusCode).toBe(401)
  })
})
