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

const PREFIX = 'export-restrictions-'

describe('GET /api/me/data-export.json — restrictions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

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
    await prisma.accountRestriction.create({
      data: {
        userId,
        type: 'UPLOAD',
        reason: 'Copyright strikes',
        bannedById: board.id,
        liftedAt: new Date('2026-10-20T00:00:00Z'),
      },
    })
  })

  afterAll(async () => {
    await prisma.accountRestriction.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists past and current restrictions without the issuer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const [row] = res.json().restrictions
    expect(row).toMatchObject({
      type: 'UPLOAD',
      reason: 'Copyright strikes',
      liftedAt: '2026-10-20T00:00:00.000Z',
    })
    expect(row).not.toHaveProperty('bannedById')
  })
})
