// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { auditLog } from '../../lib/audit.js'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const PREFIX = 'audit-export-'

describe('GET /api/admin/audit/export.csv', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let boardId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'audit-export-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98300,
    })
    boardId = board.id
    boardCookie = await sessionCookieFor(prisma, board.id)
    await auditLog(prisma, {
      action: 'GRANT_RUN',
      actorId: boardId,
      targetId: '2031',
      meta: { test: true },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires board role', async () => {
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'audit-export-member',
      isMember: true,
      memberNumber: 98301,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit/export.csv',
      headers: { cookie: await sessionCookieFor(prisma, member.id) },
    })
    expect(res.statusCode).toBe(403)
    await prisma.user.delete({ where: { id: member.id } })
  })

  it('exports audit rows as CSV', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit/export.csv',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('GRANT_RUN')
    expect(res.body).toContain(boardId)
  })

  it('GET /api/admin/audit returns paginated JSON', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit?limit=10',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { total: number; items: Array<{ action: string }> }
    expect(body.total).toBeGreaterThan(0)
    expect(body.items.some((i) => i.action === 'GRANT_RUN')).toBe(true)
  })

  it('filters governance topics and hides ops actions by default', async () => {
    await auditLog(prisma, {
      action: 'CHAT_BAN',
      actorId: boardId,
      targetId: 'chat-user',
      meta: { reason: 'test' },
    })
    const governance = await app.inject({
      method: 'GET',
      url: '/api/admin/audit?topic=finance&limit=50',
      headers: { cookie: boardCookie },
    })
    expect(governance.statusCode).toBe(200)
    const finance = governance.json() as { items: Array<{ action: string; topic: string | null }> }
    expect(finance.items.length).toBeGreaterThan(0)
    expect(
      finance.items.every((item) => item.action === 'GRANT_RUN' || item.topic === 'finance'),
    ).toBe(true)
    expect(finance.items.some((item) => item.action === 'CHAT_BAN')).toBe(false)

    const all = await app.inject({
      method: 'GET',
      url: '/api/admin/audit?scope=all&action=CHAT_BAN&limit=10',
      headers: { cookie: boardCookie },
    })
    expect(all.statusCode).toBe(200)
    expect(
      (all.json() as { items: Array<{ action: string }> }).items.some(
        (i) => i.action === 'CHAT_BAN',
      ),
    ).toBe(true)
  })

  it('redacts vote choice and actor from the board audit log', async () => {
    await auditLog(prisma, {
      action: 'VOTE_CAST',
      actorId: boardId,
      targetId: 'motion-secret',
      meta: { choice: 'YES' },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit?action=VOTE_CAST&limit=20',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const vote = (
      res.json() as { items: Array<{ actorId: string; meta: Record<string, unknown> }> }
    ).items.find((item) => item.meta && 'ballot' in item.meta)
    expect(vote).toBeTruthy()
    expect(vote?.actorId).toBe('hidden')
    expect(vote?.meta).toEqual({ ballot: 'secret' })
  })
})
