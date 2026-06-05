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

const PREFIX = 'admin-report-'

describe('M21-G — annual reports', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-report-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await prisma.annualReport.deleteMany({})
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST /api/admin/reports/annual/:year assembles markdown', async () => {
    const year = 2026
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/reports/annual/${year}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; markdown: string; downloadUrl: string }
    expect(body.ok).toBe(true)
    expect(body.markdown).toContain(`Annual transparency report ${year}`)
    expect(body.downloadUrl).toContain('minio.test')
  })

  it('GET /api/admin/reports lists stored reports', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/reports',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json() as Array<{ year: number }>
    expect(rows.some((r) => r.year === 2026)).toBe(true)
  })
})
