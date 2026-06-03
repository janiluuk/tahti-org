// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const PREFIX = 'ledger-export-'

describe('GET /api/admin/ledger/export.csv', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'ledger-export-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98310,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns CSV with rollup and entry sections', async () => {
    const year = new Date().getFullYear()
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/ledger/export.csv?year=${year}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.body).toContain('Tahti ry ledger export')
    expect(res.body).toContain('section,yearMonth,category')
    expect(res.body).toContain('id,createdAt,category')
  })
})
