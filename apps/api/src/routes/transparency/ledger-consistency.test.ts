// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
} from '../../test/helpers.js'

const PREFIX = 'ledger-ytd-'
const YEAR = new Date().getFullYear()

describe('transparency YTD vs ledger export', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.monthlyRollup.deleteMany({ where: { yearMonth: { startsWith: `${YEAR}-` } } })

    await prisma.monthlyRollup.create({
      data: {
        yearMonth: `${YEAR}-06`,
        byCategory: { REVENUE_SUBSCRIPTION: '4000', COST_STRIPE: '-120' },
        surplus: '3880',
      },
    })

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'ledger-ytd-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98320,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await prisma.monthlyRollup.deleteMany({ where: { yearMonth: { startsWith: `${YEAR}-` } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rollup surplus in export matches public YTD running surplus', async () => {
    const ytd = await app.inject({ method: 'GET', url: '/api/v1/transparency/ytd' })
    expect(ytd.statusCode).toBe(200)
    const runningSurplus = BigInt(ytd.json().runningSurplus)

    const csv = await app.inject({
      method: 'GET',
      url: `/api/admin/ledger/export.csv?year=${YEAR}`,
      headers: { cookie: boardCookie },
    })
    expect(csv.statusCode).toBe(200)

    const surplusByMonth = new Map<string, bigint>()
    for (const line of csv.body.split('\n')) {
      if (!line.startsWith('rollup,')) continue
      const parts = line.split(',')
      const yearMonth = parts[1]
      const surplus = parts[parts.length - 1]
      if (yearMonth && surplus && /^-?\d+$/.test(surplus)) {
        surplusByMonth.set(yearMonth, BigInt(surplus))
      }
    }
    let rollupSurplusSum = 0n
    for (const v of surplusByMonth.values()) rollupSurplusSum += v

    expect(rollupSurplusSum).toBe(runningSurplus)
  })
})
