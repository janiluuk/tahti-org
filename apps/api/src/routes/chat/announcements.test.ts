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

const PREFIX = 'chat-announce-'

describe('GET /api/chat/:slug/announcements', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let slug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    slug = `${PREFIX}artist`
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98450,
    })
    const cookie = await sessionCookieFor(prisma, artist.id)

    for (const body of ['First pin', 'Second pin', 'Third pin', 'Fourth pin']) {
      await app.inject({
        method: 'POST',
        url: '/api/me/chat/announcements',
        headers: { cookie, 'content-type': 'application/json' },
        payload: { body },
      })
    }
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns at most 3 announcements newest-first', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/chat/${slug}/announcements`,
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json() as Array<{ body: string; createdAt: string }>
    expect(rows).toHaveLength(3)
    expect(rows[0].body).toBe('Fourth pin')
    expect(rows[2].body).toBe('Second pin')
  })

  it('returns 404 for unknown channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/chat/no-such-slug-xyz/announcements',
    })
    expect(res.statusCode).toBe(404)
  })
})
