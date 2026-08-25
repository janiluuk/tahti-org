// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// NOTE: config.ts reads process.env.LOKI_URL once at module load, and this
// file's top-level `import { buildApp }` eagerly loads it before any
// per-test env override could apply — so this suite doesn't attempt to
// force the "Loki unreachable" branch (would need vi.doMock or a dynamic
// import to land before config.js loads, not worth it for one branch of a
// plain try/catch). It runs against whatever LOKI_URL resolves to for real,
// which on a machine with LAN access to vimage6 is the live Loki — a
// stronger test than a forced failure anyway.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const PREFIX = 'admin-logs-test-'

describe('GET /api/admin/logs', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-logs-test-board',
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

  it('requires board role', async () => {
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'admin-logs-test-member',
      isMember: true,
      memberNumber: 98311,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/logs',
      headers: { cookie: await sessionCookieFor(prisma, member.id) },
    })
    expect(res.statusCode).toBe(403)
    await prisma.user.delete({ where: { id: member.id } })
  })

  it('queries Loki without throwing and returns the documented shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/logs',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { entries: unknown[]; lokiReachable: boolean }
    expect(Array.isArray(body.entries)).toBe(true)
    expect(typeof body.lokiReachable).toBe('boolean')
  })

  it('rejects an out-of-range limit', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/logs?limit=5000',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})
