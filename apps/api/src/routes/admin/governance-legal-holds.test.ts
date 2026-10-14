// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'governance-holds-test-'
const YEAR = 2088

describe('list of legal holds', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let memberCookie: string
  let boardId: string

  async function cleanup() {
    await prisma.governanceMeeting.deleteMany({ where: { title: { startsWith: 'Holds test ' } } })
    await prisma.governanceDocument.deleteMany({ where: { title: { startsWith: 'Holds test ' } } })
    await prisma.boardResolution.deleteMany({ where: { title: { startsWith: 'Holds test ' } } })
    await prisma.annualReport.deleteMany({ where: { year: YEAR } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'governance-holds-board',
      isMember: true,
      isBoard: true,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'governance-holds-member',
      isMember: true,
    })
    boardId = board.id
    boardCookie = await sessionCookieFor(prisma, board.id)
    memberCookie = await sessionCookieFor(prisma, member.id)
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('lists held records of every kind, newest hold first, and nothing that is not held', async () => {
    const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000)
    const meeting = await prisma.governanceMeeting.create({
      data: {
        title: 'Holds test meeting',
        type: 'GENERAL',
        createdById: boardId,
        legalHoldAt: at(4),
        legalHoldReason: 'Meeting dispute',
      },
    })
    await prisma.governanceMeeting.create({
      data: { title: 'Holds test free meeting', type: 'GENERAL', createdById: boardId },
    })
    const document = await prisma.governanceDocument.create({
      data: {
        title: 'Holds test bylaws',
        type: 'BYLAWS',
        version: 3,
        createdById: boardId,
        legalHoldAt: at(1),
        legalHoldReason: 'Registry query',
      },
    })
    const resolution = await prisma.boardResolution.create({
      data: {
        title: 'Holds test resolution',
        body: 'x',
        votedAt: new Date(),
        outcome: 'PASSED',
        voteFor: 2,
        voteAgainst: 0,
        voteAbstain: 0,
        createdById: boardId,
        legalHoldAt: at(3),
        legalHoldReason: 'Audit',
      },
    })
    await prisma.annualReport.create({
      data: {
        year: YEAR,
        storageKey: 'reports/holds-test.md',
        generatedById: boardId,
        legalHoldAt: at(2),
        legalHoldReason: 'Tax office',
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/governance/legal-holds',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const ours = (res.json() as Array<{ kind: string; id: string; title: string }>).filter(
      (row) => row.title.startsWith('Holds test ') || row.id === String(YEAR),
    )
    expect(ours).toEqual([
      expect.objectContaining({
        kind: 'DOCUMENT',
        id: document.id,
        title: 'Holds test bylaws (v3)',
        legalHoldReason: 'Registry query',
      }),
      expect.objectContaining({
        kind: 'ANNUAL_REPORT',
        id: String(YEAR),
        title: `Annual report ${YEAR}`,
      }),
      expect.objectContaining({ kind: 'RESOLUTION', id: resolution.id.toString() }),
      expect.objectContaining({ kind: 'MEETING', id: meeting.id }),
    ])
  })

  it('is for the board only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/governance/legal-holds',
      headers: { cookie: memberCookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
