// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const TEST_EMAIL_PREFIX = 'grants-test-'
const YEAR = 2031 // a year unlikely to collide with other fixtures

async function makeArtist(opts: {
  email: string
  username: string
  displayName: string
  isBoard?: boolean
  publicAttribution?: boolean
  memberNumber: number
}) {
  const passwordHash = await hashPassword('testpassword')
  return prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      username: opts.username,
      displayName: opts.displayName,
      emailVerifiedAt: new Date(),
      isMember: true,
      isBoard: opts.isBoard ?? false,
      memberNumber: opts.memberNumber,
      memberSince: new Date(),
      publicAttribution: opts.publicAttribution ?? true,
      channel: {
        create: {
          slug: opts.username,
          liveSourceMount: `/live/${opts.username}`,
          liveSourcePass: 'x',
          liveSourcePassHash: 'x',
          rtmpStreamKey: `${opts.username}__x`,
          rtmpStreamKeyHash: 'x',
        },
      },
    },
    include: { channel: true },
  })
}

async function seedDownloads(channelId: string, countedCount: number) {
  const counted = new Date(Date.UTC(YEAR, 5, 1))
  for (let i = 0; i < countedCount; i++) {
    await prisma.download.create({
      data: {
        channelId,
        archiveItemId: `item-${channelId}-${i}`,
        format: 'mp3_320',
        byFingerprint: `fp-${channelId}-${i}`,
        byIpHash: `ip-${i}`,
        weight: 1,
        countedAt: counted,
      },
    })
  }
}

describe('M9 — annual grant calculation', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistACookie: string
  let artistA: Awaited<ReturnType<typeof makeArtist>>
  let artistB: Awaited<ReturnType<typeof makeArtist>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    // Clean prior fixtures (downloads + grants + rollups + users).
    await prisma.grantDisbursement.deleteMany({ where: { forYear: YEAR } })
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: { contains: `:${YEAR}:` } } })
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: `reserve:${YEAR}` } })
    await prisma.monthlyRollup.deleteMany({ where: { yearMonth: { startsWith: `${YEAR}-` } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })

    const board = await makeArtist({
      email: `${TEST_EMAIL_PREFIX}board@example.com`,
      username: 'grants-board',
      displayName: 'Grants Board',
      isBoard: true,
      memberNumber: 9001,
    })
    artistA = await makeArtist({
      email: `${TEST_EMAIL_PREFIX}a@example.com`,
      username: 'grants-artist-a',
      displayName: 'Artist A',
      memberNumber: 9002,
    })
    artistB = await makeArtist({
      email: `${TEST_EMAIL_PREFIX}b@example.com`,
      username: 'grants-artist-b',
      displayName: 'Artist B',
      publicAttribution: false,
      memberNumber: 9003,
    })

    boardCookie = `tahti_session=${(await createSession(prisma, board.id)).id}`
    artistACookie = `tahti_session=${(await createSession(prisma, artistA.id)).id}`

    // Surplus: €1,000 across the year (two monthly rollups summing to 100000c).
    await prisma.monthlyRollup.create({
      data: {
        yearMonth: `${YEAR}-01`,
        byCategory: {},
        surplus: BigInt(60_000),
        finalizedAt: new Date(),
      },
    })
    await prisma.monthlyRollup.create({
      data: {
        yearMonth: `${YEAR}-02`,
        byCategory: {},
        surplus: BigInt(40_000),
        finalizedAt: new Date(),
      },
    })

    // Engagement: A gets 60 counted downloads, B gets 40. Total 100 units.
    await seedDownloads(artistA.channel!.id, 60)
    await seedDownloads(artistB.channel!.id, 40)
  })

  afterAll(async () => {
    await prisma.grantDisbursement.deleteMany({ where: { forYear: YEAR } })
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: { contains: `:${YEAR}:` } } })
    await prisma.ledgerEntry.deleteMany({ where: { externalRef: `reserve:${YEAR}` } })
    await prisma.monthlyRollup.deleteMany({ where: { yearMonth: { startsWith: `${YEAR}-` } } })
    for (const c of [artistA, artistB]) {
      await prisma.download.deleteMany({ where: { channelId: c.channel!.id } })
    }
    await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } })
    await app.close()
  })

  it('refuses the run for non-board members', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/grants/run/${YEAR}`,
      headers: { cookie: artistACookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('computes grants: €900 pool split 60/40 within 1 cent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/grants/run/${YEAR}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.surplusCents).toBe(100_000)
    expect(body.reserveCents).toBe(10_000) // 10% reserve
    expect(body.poolCents).toBe(90_000)
    expect(body.totalUnits).toBe(100)
    expect(body.grantCount).toBe(2)

    // A: 60/100 × 90000 = 54000; B: 40/100 × 90000 = 36000
    const grants = await prisma.grantDisbursement.findMany({
      where: { forYear: YEAR },
      orderBy: { amountCents: 'desc' },
    })
    expect(grants.map((g) => Number(g.amountCents))).toEqual([54_000, 36_000])
    const sum = grants.reduce((s, g) => s + Number(g.amountCents), 0)
    expect(Math.abs(sum - body.poolCents)).toBeLessThanOrEqual(1)
  })

  it('writes GRANT_DISBURSEMENT + RESERVE_TRANSFER ledger entries', async () => {
    const disb = await prisma.ledgerEntry.findMany({
      where: { category: 'GRANT_DISBURSEMENT', externalRef: { contains: `grant:${YEAR}:` } },
    })
    expect(disb).toHaveLength(2)

    const reserve = await prisma.ledgerEntry.findFirst({
      where: { category: 'RESERVE_TRANSFER', externalRef: `reserve:${YEAR}` },
    })
    expect(reserve).not.toBeNull()
    expect(Number(reserve!.amountCents)).toBe(10_000)
  })

  it('refuses to run the same year twice (append-only ledger)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/grants/run/${YEAR}`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(409)
  })

  it('publishes an anonymized public grant report', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/transparency/grants/${YEAR}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.grantCount).toBe(2)
    const names = body.grants.map((g: { publishedAs: string }) => g.publishedAs)
    // Artist A opted into public attribution; B did not → anonymized.
    expect(names).toContain('Artist A')
    expect(names).toContain('Channel #9003')
  })

  it('lets an artist see their own grant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/grants',
      headers: { cookie: artistACookie },
    })
    expect(res.statusCode).toBe(200)
    const grants = res.json()
    expect(grants).toHaveLength(1)
    expect(grants[0].forYear).toBe(YEAR)
    expect(grants[0].amountCents).toBe('54000')
    expect(grants[0].units).toBe(60)
  })
})
