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

describe('annual report lifecycle', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string

  async function cleanup() {
    await prisma.annualReport.deleteMany({ where: { year: YEARS } })
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
        where: { action: 'ANNUAL_REPORT_APPROVE', targetId: '2090' },
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
        where: { action: 'ANNUAL_REPORT_PUBLISH', targetId: '2092' },
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
})
