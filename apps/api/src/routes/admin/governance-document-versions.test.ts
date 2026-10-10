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

const PREFIX = 'governance-docver-test-'

type Doc = {
  id: string
  version: number
  supersedesId: string | null
  supersededById: string | null
}

describe('governance document versions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string

  async function cleanup() {
    await prisma.governanceDocument.deleteMany({
      where: { createdBy: { email: { startsWith: PREFIX } } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  function create(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/api/admin/governance/documents',
      headers: { cookie: boardCookie },
      payload: { title: 'Tahti ry bylaws', type: 'BYLAWS', ...payload },
    })
  }

  async function list(url: string, who: string) {
    const res = await app.inject({ method: 'GET', url, headers: { cookie: who } })
    return res.json() as Doc[]
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'governance-docver-board',
      isMember: true,
      isBoard: true,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'governance-docver-member',
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    memberCookie = await sessionCookieFor(prisma, member.id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('links a new version to the one it replaces and numbers it', async () => {
    const v1 = (await create({ version: 1, publishedAt: '2026-01-01T00:00:00.000Z' })).json() as Doc
    expect(v1).toMatchObject({ version: 1, supersedesId: null, supersededById: null })

    const res = await create({ supersedesId: v1.id })
    expect(res.statusCode).toBe(201)
    const v2 = res.json() as Doc
    expect(v2).toMatchObject({ version: 2, supersedesId: v1.id, supersededById: null })

    const admin = await list('/api/admin/governance/documents', boardCookie)
    expect(admin.find((d) => d.id === v1.id)?.supersededById).toBe(v2.id)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'DOCUMENT_CREATE', targetId: v2.id },
    })
    expect(audit?.meta).toMatchObject({ version: 2, supersedesId: v1.id })
  })

  it('shows members the successor only once it is published', async () => {
    const v1 = (await create({ version: 1, publishedAt: '2026-02-01T00:00:00.000Z' })).json() as Doc
    const v2 = (await create({ supersedesId: v1.id })).json() as Doc

    let rows = await list('/api/v1/governance/documents', memberCookie)
    expect(rows.find((d) => d.id === v2.id)).toBeUndefined()
    expect(rows.find((d) => d.id === v1.id)?.supersededById).toBeNull()

    await prisma.governanceDocument.update({
      where: { id: v2.id },
      data: { publishedAt: new Date() },
    })
    rows = await list('/api/v1/governance/documents', memberCookie)
    expect(rows.find((d) => d.id === v1.id)?.supersededById).toBe(v2.id)
    expect(rows.find((d) => d.id === v2.id)?.supersedesId).toBe(v1.id)
  })

  it('refuses a second successor, another type, a lower version or a missing document', async () => {
    const v1 = (await create({ version: 3 })).json() as Doc
    expect((await create({ supersedesId: v1.id, version: 3 })).statusCode).toBe(400)
    expect((await create({ supersedesId: v1.id, type: 'POLICY' })).statusCode).toBe(400)
    expect((await create({ supersedesId: 'missing-document' })).statusCode).toBe(400)

    const v2 = await create({ supersedesId: v1.id, version: 7 })
    expect(v2.statusCode).toBe(201)
    expect((v2.json() as Doc).version).toBe(7)
    expect((await create({ supersedesId: v1.id })).statusCode).toBe(409)
  })

  describe('archiving', () => {
    function archive(who: string, id: string, archived: unknown) {
      return app.inject({
        method: 'PATCH',
        url: `/api/admin/governance/documents/${id}`,
        headers: { cookie: who },
        payload: { archived },
      })
    }

    it('takes a published document out of the member list and can put it back', async () => {
      const doc = (
        await create({ title: 'Posted by mistake', type: 'OTHER', publishedAt: new Date() })
      ).json() as Doc

      const res = await archive(boardCookie, doc.id, true)
      expect(res.statusCode).toBe(200)
      expect(res.json().archivedAt).not.toBeNull()
      // Archiving twice is one audit entry.
      await archive(boardCookie, doc.id, true)

      let rows = await list('/api/v1/governance/documents', memberCookie)
      expect(rows.find((d) => d.id === doc.id)).toBeUndefined()
      const admin = await list('/api/admin/governance/documents', boardCookie)
      expect(admin.find((d) => d.id === doc.id)).toBeDefined()

      expect((await archive(boardCookie, doc.id, false)).json().archivedAt).toBeNull()
      rows = await list('/api/v1/governance/documents', memberCookie)
      expect(rows.find((d) => d.id === doc.id)).toBeDefined()

      const audits = await prisma.auditLog.findMany({
        where: { action: 'DOCUMENT_ARCHIVE', targetId: doc.id },
        orderBy: { id: 'asc' },
      })
      expect(audits.map((a) => a.meta)).toEqual([
        { title: 'Posted by mistake', archived: true },
        { title: 'Posted by mistake', archived: false },
      ])
    })

    it('does not point members at an archived successor', async () => {
      const v1 = (await create({ version: 1, publishedAt: new Date() })).json() as Doc
      const v2 = (await create({ supersedesId: v1.id, publishedAt: new Date() })).json() as Doc
      await archive(boardCookie, v2.id, true)
      const rows = await list('/api/v1/governance/documents', memberCookie)
      expect(rows.find((d) => d.id === v1.id)?.supersededById).toBeNull()
    })

    it('is for the board only and checks its input', async () => {
      const doc = (await create({ type: 'OTHER' })).json() as Doc
      expect((await archive(memberCookie, doc.id, true)).statusCode).toBe(403)
      expect((await archive(boardCookie, doc.id, 'yes')).statusCode).toBe(400)
      expect((await archive(boardCookie, 'missing-document', true)).statusCode).toBe(404)
    })
  })
})
