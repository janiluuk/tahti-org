// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { processRevelatorRoyaltySyncJob } from './revelator-royalty-sync.js'

const PREFIX = 'worker-revelator-royalty-'

describe('processRevelatorRoyaltySyncJob', () => {
  let releaseId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash: 'hash',
        username: `${PREFIX}artist`,
        displayName: 'Royalty Artist',
        tier: 'ARTIST',
        isMember: true,
        memberNumber: 98383,
      },
    })

    const release = await prisma.release.create({
      data: {
        userId: user.id,
        title: 'Sync Test EP',
        type: 'EP',
        releaseDate: new Date('2026-01-01'),
        smartLinkSlug: `${PREFIX}slug`,
        revelatorId: 'stub-sync-release',
        revelatorStatus: 'submitted',
      },
    })
    releaseId = release.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  it('upserts royalty rows for syncable releases', async () => {
    const summary = await processRevelatorRoyaltySyncJob(prisma, {
      data: { yearMonth: '2026-04' },
    } as never)

    expect(summary.period).toBe('2026-04')
    expect(summary.releases).toBeGreaterThanOrEqual(1)
    expect(summary.upserted).toBeGreaterThanOrEqual(1)

    const rows = await prisma.revelatorRoyaltyReport.findMany({
      where: { releaseId },
    })
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows[0].amountCents).toBeGreaterThan(0)
  })

  it('re-sync updates existing rows idempotently', async () => {
    const first = await processRevelatorRoyaltySyncJob(prisma, {
      data: { yearMonth: '2026-03' },
    } as never)
    const second = await processRevelatorRoyaltySyncJob(prisma, {
      data: { yearMonth: '2026-03' },
    } as never)

    expect(first.upserted).toBeGreaterThanOrEqual(1)
    expect(second.upserted).toBeGreaterThanOrEqual(1)

    const rows = await prisma.revelatorRoyaltyReport.findMany({
      where: { releaseId, periodStart: new Date('2026-03-01T00:00:00.000Z') },
    })
    expect(rows).toHaveLength(1)
  })

  it('skips releases without revelatorId', async () => {
    const user = await prisma.user.findFirst({
      where: { email: `${PREFIX}artist@example.com` },
    })
    const pending = await prisma.release.create({
      data: {
        userId: user!.id,
        title: 'Pending only',
        type: 'SINGLE',
        releaseDate: new Date('2026-01-01'),
        smartLinkSlug: `${PREFIX}pending`,
        revelatorStatus: 'pending',
      },
    })

    const summary = await processRevelatorRoyaltySyncJob(prisma, {
      data: { yearMonth: '2026-02' },
    } as never)

    const rows = await prisma.revelatorRoyaltyReport.findMany({
      where: { releaseId: pending.id },
    })
    expect(rows).toHaveLength(0)
    expect(summary.releases).toBeGreaterThanOrEqual(1)
  })

  it('throws on invalid yearMonth', async () => {
    await expect(
      processRevelatorRoyaltySyncJob(prisma, { data: { yearMonth: 'bad' } } as never),
    ).rejects.toThrow(/Invalid yearMonth/)
  })
})
