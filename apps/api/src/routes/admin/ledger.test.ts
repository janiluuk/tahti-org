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

const PREFIX = 'ledger-admin-'

describe('POST /api/admin/ledger', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'ledger-admin-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98311,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { description: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects invalid category via Zod', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/ledger',
      headers: { cookie: boardCookie },
      payload: {
        category: 'FAN_SUB_GROSS_RECEIVED',
        amountCents: 100,
        description: `${PREFIX} bad`,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates a manual ledger entry', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/ledger',
      headers: { cookie: boardCookie },
      payload: {
        category: 'COST_OPERATIONS',
        amountCents: 2500,
        description: `${PREFIX} ops cost`,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().category).toBe('COST_OPERATIONS')
  })
})
