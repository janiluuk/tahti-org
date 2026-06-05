// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const YEAR = 2030
const PREFIX = 'transparency-res-'

describe('Transparency API (public)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.grantDisbursement.deleteMany({ where: { forYear: YEAR } })
    await prisma.monthlyRollup.deleteMany({ where: { yearMonth: { startsWith: `${YEAR}-` } } })
  })

  afterAll(async () => {
    await prisma.boardResolution.deleteMany({})
    await prisma.grantDisbursement.deleteMany({ where: { forYear: YEAR } })
    await prisma.monthlyRollup.deleteMany({ where: { yearMonth: { startsWith: `${YEAR}-` } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /categories is public and lists revenue codes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transparency/categories' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['access-control-allow-origin']).toBe('*')
    const codes = res.json().revenue.map((r: { code: string }) => r.code)
    expect(codes).toContain('REVENUE_SUBSCRIPTION')
  })

  it('GET /monthly_rollup returns rollups for the requested year', async () => {
    await prisma.monthlyRollup.create({
      data: {
        yearMonth: `${YEAR}-06`,
        byCategory: { REVENUE_SUBSCRIPTION: '1000' },
        surplus: BigInt(500),
        finalizedAt: new Date(),
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/transparency/monthly_rollup?year=${YEAR}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].yearMonth).toBe(`${YEAR}-06`)
  })

  it('GET /transparency/ytd returns running surplus key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transparency/ytd' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('runningSurplus')
  })

  it('GET /grants/:year returns grant report shape', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/transparency/grants/${YEAR}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().year).toBe(YEAR)
    expect(res.json()).toHaveProperty('grants')
  })

  it('rejects invalid grant year', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transparency/grants/notayear' })
    expect(res.statusCode).toBe(400)
  })

  it('GET /resolutions returns published resolutions for year', async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'transparency-res-board',
    })
    await prisma.boardResolution.create({
      data: {
        title: 'Test resolution',
        body: 'Approved in test.',
        votedAt: new Date(`${YEAR}-06-01T12:00:00.000Z`),
        outcome: 'PASSED',
        voteFor: 3,
        voteAgainst: 0,
        voteAbstain: 0,
        createdById: board.id,
        publishedAt: new Date(),
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/transparency/resolutions?year=${YEAR}`,
    })
    expect(res.statusCode).toBe(200)
    const rows = res.json() as Array<{ title: string }>
    expect(rows.some((r) => r.title === 'Test resolution')).toBe(true)
  })
})
