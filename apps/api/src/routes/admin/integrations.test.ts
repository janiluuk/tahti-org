// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const PREFIX = 'admin-integrations-'

describe('GET /api/admin/integrations', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'admin-integrations-artist',
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-integrations-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98150,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns distribution integration status for board users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/integrations',
      headers: { cookie: boardCookie },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      integrations: Array<{ id: string; configured: boolean; mode: string }>
    }
    expect(body.integrations).toHaveLength(2)
    expect(body.integrations.map((i) => i.id).sort()).toEqual(['mixcloud', 'revelator'])
    for (const row of body.integrations) {
      expect(['live', 'stub']).toContain(row.mode)
    }
  })

  it('rejects non-board users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/integrations',
      headers: { cookie: artistCookie },
    })

    expect(res.statusCode).toBe(403)
  })
})
