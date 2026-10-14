// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/governance-document.pdf'),
  presignedPutUrl: vi.fn().mockResolvedValue('https://minio.test/upload'),
}))

const PREFIX = 'governance-dochold-test-'

describe('governance document legal hold', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string

  async function cleanup() {
    await prisma.governanceDocument.deleteMany({
      where: { createdBy: { email: { startsWith: PREFIX } } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  async function createDocument() {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/governance/documents',
      headers: { cookie: boardCookie },
      payload: { title: 'Board minutes 2026/3', type: 'OTHER', publishedAt: new Date() },
    })
    return res.json() as { id: string }
  }

  function hold(who: string, id: string, payload?: Record<string, unknown>) {
    return app.inject({
      method: payload ? 'PUT' : 'DELETE',
      url: `/api/admin/governance/documents/${id}/legal-hold`,
      headers: { cookie: who },
      ...(payload ? { payload } : {}),
    })
  }

  function patch(id: string, payload: Record<string, unknown>) {
    return app.inject({
      method: 'PATCH',
      url: `/api/admin/governance/documents/${id}`,
      headers: { cookie: boardCookie },
      payload,
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'governance-dochold-board',
      isMember: true,
      isBoard: true,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'governance-dochold-member',
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    memberCookie = await sessionCookieFor(prisma, member.id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('blocks edits and archiving while held, and allows them once lifted', async () => {
    const doc = await createDocument()
    const res = await hold(boardCookie, doc.id, { reason: 'Auditor review 2026' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ legalHoldReason: 'Auditor review 2026' })
    expect(res.json().legalHoldAt).not.toBeNull()

    expect((await patch(doc.id, { title: 'Changed' })).statusCode).toBe(409)
    expect((await patch(doc.id, { archived: true })).statusCode).toBe(409)
    // Restoring is not blocked: it puts the record back in front of members.
    expect((await patch(doc.id, { archived: false })).statusCode).toBe(200)

    const lifted = await hold(boardCookie, doc.id)
    expect(lifted.json()).toMatchObject({ legalHoldAt: null, legalHoldReason: null })
    expect((await patch(doc.id, { title: 'Changed' })).statusCode).toBe(200)

    const audits = await prisma.auditLog.findMany({
      where: { action: 'DOCUMENT_LEGAL_HOLD', targetId: doc.id },
      orderBy: { id: 'asc' },
    })
    expect(audits.map((a) => a.meta)).toEqual([
      { title: 'Board minutes 2026/3', held: true, reason: 'Auditor review 2026' },
      { title: 'Board minutes 2026/3', held: false },
    ])
  })

  it('keeps the first hold time when the reason changes and audits only real changes', async () => {
    const doc = await createDocument()
    const first = (await hold(boardCookie, doc.id, { reason: 'Dispute' })).json()
    await hold(boardCookie, doc.id, { reason: 'Dispute' })
    const second = (await hold(boardCookie, doc.id, { reason: 'Dispute and audit' })).json()
    expect(second.legalHoldAt).toBe(first.legalHoldAt)
    await hold(boardCookie, doc.id)
    await hold(boardCookie, doc.id)
    expect(
      await prisma.auditLog.count({ where: { action: 'DOCUMENT_LEGAL_HOLD', targetId: doc.id } }),
    ).toBe(3)
  })

  it('shows members that a document is held but not why', async () => {
    const doc = await createDocument()
    await hold(boardCookie, doc.id, { reason: 'Personal data request' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/documents',
      headers: { cookie: memberCookie },
    })
    const row = (res.json() as Array<Record<string, unknown>>).find((d) => d.id === doc.id)
    expect(row?.legalHoldAt).not.toBeNull()
    expect(row?.legalHoldReason).toBeNull()
  })

  it('is for the board only and checks its input', async () => {
    const doc = await createDocument()
    expect((await hold(memberCookie, doc.id, { reason: 'x' })).statusCode).toBe(403)
    expect((await hold(boardCookie, doc.id, { reason: '' })).statusCode).toBe(400)
    expect((await hold(boardCookie, 'missing-document', { reason: 'x' })).statusCode).toBe(404)
    expect((await hold(boardCookie, 'missing-document')).statusCode).toBe(404)
  })
})
