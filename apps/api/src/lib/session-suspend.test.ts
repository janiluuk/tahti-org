// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist, sessionCookieFor } from '../test/helpers.js'

const PREFIX = 'session-suspend-'

describe('suspended users lose session auth', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'session-suspend-user',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 99101,
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects requireAuth routes once suspendedAt is set', async () => {
    const before = await app.inject({
      method: 'GET',
      url: '/api/me/profile',
      headers: { cookie },
    })
    expect(before.statusCode).toBe(200)

    await prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })

    const after = await app.inject({
      method: 'GET',
      url: '/api/me/profile',
      headers: { cookie },
    })
    expect(after.statusCode).toBe(401)
  })
})
