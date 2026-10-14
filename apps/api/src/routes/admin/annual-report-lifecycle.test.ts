// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

vi.mock('../../lib/minio.js', () => ({
  s3: {},
  putObjectText: vi.fn().mockResolvedValue(undefined),
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/report.md'),
  presignedPutUrl: vi.fn(),
}))

const PREFIX = 'annual-lifecycle-'
const YEARS = { gte: 2090, lte: 2099 }
// Audit entries cannot be removed, so only this run's count.
const STARTED = new Date()

describe('annual report lifecycle', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string

  async function cleanup() {
    await prisma.annualReport.deleteMany({ where: { year: YEARS } })
    await prisma.annualReportRevision.deleteMany({ where: { year: YEARS } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  function post(url: string, payload?: Record<string, unknown>, who = boardCookie) {
    return app.inject({
      method: 'POST',
      url,
      headers: { cookie: who },
      ...(payload ? { payload } : {}),
    })
  }

  const generate = (year: number) => post(`/api/admin/reports/annual/${year}`)

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'annual-lifecycle-board',
      isMember: true,
      isBoard: true,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'annual-lifecycle-member',
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    memberCookie = await sessionCookieFor(prisma, member.id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  describe('approval', () => {
    it('approves a generated report and stops it being regenerated in place', async () => {
      expect((await generate(2090)).statusCode).toBe(200)
      const res = await post('/api/admin/reports/annual/2090/approve')
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ year: 2090, approvalMeetingId: null })
      expect(res.json().approvedAt).not.toBeNull()

      expect((await generate(2090)).statusCode).toBe(409)
      expect((await post('/api/admin/reports/annual/2090/approve')).statusCode).toBe(409)

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ANNUAL_REPORT_APPROVE', targetId: '2090', createdAt: { gte: STARTED } },
      })
      expect(audit?.meta).toMatchObject({ year: 2090, meetingId: null })
    })

    it('refuses a missing report, an unknown meeting and non-board callers', async () => {
      expect((await post('/api/admin/reports/annual/2091/approve')).statusCode).toBe(404)
      await generate(2091)
      expect(
        (
          await post('/api/admin/reports/annual/2091/approve', {
            meetingId: 'cjld2cjxh0000qzrmn831i7rn',
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (await post('/api/admin/reports/annual/2091/approve', undefined, memberCookie)).statusCode,
      ).toBe(403)
      expect((await post('/api/admin/reports/annual/20x1/approve')).statusCode).toBe(400)
    })
  })

  describe('publication', () => {
    async function memberYears() {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/governance/annual-reports',
        headers: { cookie: memberCookie },
      })
      expect(res.statusCode).toBe(200)
      return (res.json() as Array<{ year: number }>).map((r) => r.year).filter((y) => y >= 2090)
    }

    it('shows members a report only once it is approved and published', async () => {
      await generate(2092)
      expect((await post('/api/admin/reports/annual/2092/publish')).statusCode).toBe(409)
      expect(await memberYears()).not.toContain(2092)

      await post('/api/admin/reports/annual/2092/approve')
      const res = await post('/api/admin/reports/annual/2092/publish')
      expect(res.statusCode).toBe(200)
      expect(res.json().publishedAt).not.toBeNull()
      expect((await post('/api/admin/reports/annual/2092/publish')).statusCode).toBe(409)
      expect(await memberYears()).toContain(2092)

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ANNUAL_REPORT_PUBLISH', targetId: '2092', createdAt: { gte: STARTED } },
      })
      expect(audit?.meta).toMatchObject({ year: 2092 })
    })

    it('is for the board only', async () => {
      expect(
        (await post('/api/admin/reports/annual/2092/publish', undefined, memberCookie)).statusCode,
      ).toBe(403)
      expect((await post('/api/admin/reports/annual/2093/publish')).statusCode).toBe(404)
    })
  })

  describe('filing', () => {
    function file(year: number, payload: Record<string, unknown>) {
      return app.inject({
        method: 'PUT',
        url: `/api/admin/reports/annual/${year}/filing`,
        headers: { cookie: boardCookie },
        payload,
      })
    }

    it('records, changes and clears the filing of an approved report', async () => {
      await generate(2094)
      expect((await file(2094, { filedAt: new Date().toISOString() })).statusCode).toBe(409)
      await post('/api/admin/reports/annual/2094/approve')

      const filedAt = new Date(Date.now() + 60000).toISOString()
      const res = await file(2094, { filedAt, filingReference: 'PRH 2094/123' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ filedAt, filingReference: 'PRH 2094/123' })
      // The same values again are not a new audit entry.
      await file(2094, { filedAt, filingReference: 'PRH 2094/123' })

      const cleared = await file(2094, { filedAt: null, filingReference: 'ignored' })
      expect(cleared.json()).toMatchObject({ filedAt: null, filingReference: null })

      const audits = await prisma.auditLog.findMany({
        where: { action: 'ANNUAL_REPORT_FILE', targetId: '2094', createdAt: { gte: STARTED } },
        orderBy: { id: 'asc' },
      })
      expect(
        audits.map((a) => (a.meta as { filingReference: string | null }).filingReference),
      ).toEqual(['PRH 2094/123', null])
    })

    it('refuses a filing date before the approval and bad input', async () => {
      await generate(2095)
      await post('/api/admin/reports/annual/2095/approve')
      expect((await file(2095, { filedAt: '2020-01-01T00:00:00.000Z' })).statusCode).toBe(400)
      expect((await file(2095, {})).statusCode).toBe(400)
      expect((await file(2096, { filedAt: null })).statusCode).toBe(404)
    })
  })

  describe('correction', () => {
    it('regenerates an approved report under a new file and keeps the old one', async () => {
      await generate(2097)
      expect(
        (await post('/api/admin/reports/annual/2097/correct', { note: 'Too early' })).statusCode,
      ).toBe(409)
      await post('/api/admin/reports/annual/2097/approve')
      await post('/api/admin/reports/annual/2097/publish')
      const before = await prisma.annualReport.findUniqueOrThrow({ where: { year: 2097 } })

      const res = await post('/api/admin/reports/annual/2097/correct', {
        note: 'Grant totals were missing one cycle.',
      })
      expect(res.statusCode).toBe(200)
      const after = res.json()
      expect(after.storageKey).not.toBe(before.storageKey)
      expect(after.storageKey).toContain('/2097/annual-report-corrected-')
      expect(after.correctedAt).not.toBeNull()
      expect(after.approvedAt).not.toBeNull()
      expect(after.publishedAt).not.toBeNull()

      const revisions = await app.inject({
        method: 'GET',
        url: '/api/admin/reports/annual/2097/revisions',
        headers: { cookie: boardCookie },
      })
      expect(revisions.json()).toMatchObject([{ note: 'Grant totals were missing one cycle.' }])
      const stored = await prisma.annualReportRevision.findFirstOrThrow({ where: { year: 2097 } })
      expect(stored.storageKey).toBe(before.storageKey)

      const members = await app.inject({
        method: 'GET',
        url: '/api/v1/governance/annual-reports',
        headers: { cookie: memberCookie },
      })
      const row = (members.json() as Array<{ year: number; correctedAt: string | null }>).find(
        (r) => r.year === 2097,
      )
      expect(row?.correctedAt).not.toBeNull()

      const audit = await prisma.auditLog.findFirst({
        where: { action: 'ANNUAL_REPORT_CORRECT', targetId: '2097', createdAt: { gte: STARTED } },
      })
      expect(audit?.meta).toMatchObject({ replacedStorageKey: before.storageKey })
    })

    it('needs a note and the board', async () => {
      expect((await post('/api/admin/reports/annual/2097/correct', { note: '' })).statusCode).toBe(
        400,
      )
      expect(
        (await post('/api/admin/reports/annual/2097/correct', { note: 'x' }, memberCookie))
          .statusCode,
      ).toBe(403)
      expect((await post('/api/admin/reports/annual/2098/correct', { note: 'x' })).statusCode).toBe(
        404,
      )
    })
  })

  describe('archiving', () => {
    function archive(year: number, archived: unknown, who = boardCookie) {
      return app.inject({
        method: 'PATCH',
        url: `/api/admin/reports/annual/${year}`,
        headers: { cookie: who },
        payload: { archived },
      })
    }

    async function memberYears() {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/governance/annual-reports',
        headers: { cookie: memberCookie },
      })
      return (res.json() as Array<{ year: number }>).map((r) => r.year)
    }

    it('takes a published report out of the member list and can put it back', async () => {
      await generate(2099)
      await post('/api/admin/reports/annual/2099/approve')
      await post('/api/admin/reports/annual/2099/publish')
      expect(await memberYears()).toContain(2099)

      const res = await archive(2099, true)
      expect(res.statusCode).toBe(200)
      expect(res.json().archivedAt).not.toBeNull()
      await archive(2099, true)
      expect(await memberYears()).not.toContain(2099)

      const board = await app.inject({
        method: 'GET',
        url: '/api/admin/reports',
        headers: { cookie: boardCookie },
      })
      expect((board.json() as Array<{ year: number }>).some((r) => r.year === 2099)).toBe(true)

      expect((await archive(2099, false)).json().archivedAt).toBeNull()
      expect(await memberYears()).toContain(2099)

      const audits = await prisma.auditLog.findMany({
        where: { action: 'ANNUAL_REPORT_ARCHIVE', targetId: '2099', createdAt: { gte: STARTED } },
        orderBy: { id: 'asc' },
      })
      expect(audits.map((a) => a.meta)).toEqual([
        { year: 2099, archived: true },
        { year: 2099, archived: false },
      ])
    })

    it('is for the board only and checks its input', async () => {
      expect((await archive(2099, true, memberCookie)).statusCode).toBe(403)
      expect((await archive(2099, 'yes')).statusCode).toBe(400)
      expect((await archive(2098, true)).statusCode).toBe(404)
    })
  })
})
