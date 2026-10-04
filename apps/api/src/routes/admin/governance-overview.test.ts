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

const PREFIX = 'admin-gov-overview-'

type Overview = {
  openMotions: number
  pendingVenueVerifications: number
  lastAnnualReportYear: number | null
  boardResolutionsThisYear: number
}

describe('GET /api/admin/governance/overview', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let boardId: string

  const overview = async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/governance/overview',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    return res.json() as Overview
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-gov-overview-board',
    })
    boardId = board.id
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'admin-gov-overview-member',
    })
    memberCookie = await sessionCookieFor(prisma, member.id)
  })

  afterAll(async () => {
    await prisma.motion.deleteMany({ where: { proposedBy: boardId } })
    await prisma.venue.deleteMany({ where: { createdBy: boardId } })
    await prisma.boardResolution.deleteMany({ where: { createdById: boardId } })
    await prisma.annualReport.deleteMany({ where: { generatedById: boardId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('is board-only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/governance/overview',
      headers: { cookie: memberCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('counts open motions, unverified venues and this year’s resolutions', async () => {
    const before = await overview()
    const now = new Date()
    const inAWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
    await prisma.motion.createMany({
      data: [
        {
          title: 'Open motion',
          description: 'x',
          proposedBy: boardId,
          openAt: now,
          closeAt: inAWeek,
          state: 'OPEN',
        },
        {
          title: 'Draft motion',
          description: 'x',
          proposedBy: boardId,
          openAt: now,
          closeAt: inAWeek,
          state: 'DRAFT',
        },
      ],
    })
    await prisma.venue.createMany({
      data: [
        {
          slug: `${PREFIX}unverified`,
          name: 'Unverified',
          address: 'Street 1',
          city: 'Helsinki',
          createdBy: boardId,
        },
        {
          slug: `${PREFIX}verified`,
          name: 'Verified',
          address: 'Street 2',
          city: 'Helsinki',
          createdBy: boardId,
          verifiedAt: now,
        },
      ],
    })
    const lastYear = new Date(Date.UTC(now.getUTCFullYear() - 1, 5, 1))
    for (const votedAt of [now, lastYear]) {
      await prisma.boardResolution.create({
        data: {
          title: 'Resolution',
          body: 'x',
          votedAt,
          outcome: 'PASSED',
          voteFor: 3,
          voteAgainst: 0,
          voteAbstain: 0,
          createdById: boardId,
        },
      })
    }

    const after = await overview()
    expect(after.openMotions - before.openMotions).toBe(1)
    expect(after.pendingVenueVerifications - before.pendingVenueVerifications).toBe(1)
    expect(after.boardResolutionsThisYear - before.boardResolutionsThisYear).toBe(1)
  })

  it('reports the latest annual report year', async () => {
    await prisma.annualReport.deleteMany({ where: { year: { in: [2098, 2099] } } })
    await prisma.annualReport.createMany({
      data: [2098, 2099].map((year) => ({
        year,
        storageKey: `reports/${year}.pdf`,
        generatedById: boardId,
      })),
    })
    expect((await overview()).lastAnnualReportYear).toBe(2099)
  })
})
