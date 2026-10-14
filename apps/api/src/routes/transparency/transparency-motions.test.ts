// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { motionResultDigest } from '../../lib/motion-certificate.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'transparency-motions-'

type Row = {
  id: string
  voteFor: number
  voteAgainst: number
  voteAbstain: number
  tallySource: string
}

describe('closed motions in the transparency history', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let voterIds: string[]
  let proposerId: string

  async function cleanup() {
    await prisma.motion.deleteMany({ where: { proposer: { email: { startsWith: PREFIX } } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  }

  async function closedMotion(title: string, certified: boolean) {
    const openAt = new Date(Date.UTC(2026, 4, 1))
    const closeAt = new Date(Date.UTC(2026, 4, 8))
    const motion = await prisma.motion.create({
      data: {
        title,
        description: 'Details',
        proposedBy: proposerId,
        openAt,
        closeAt,
        state: 'CLOSED',
        eligibleMemberCount: 10,
      },
    })
    await prisma.vote.createMany({
      data: [
        { motionId: motion.id, userId: voterIds[0]!, choice: 'YES' },
        { motionId: motion.id, userId: voterIds[1]!, choice: 'YES' },
        { motionId: motion.id, userId: voterIds[2]!, choice: 'NO' },
      ],
    })
    if (certified) {
      const tally = { YES: 2, NO: 1, ABSTAIN: 0 }
      const closedAt = closeAt
      await prisma.motion.update({
        where: { id: motion.id },
        data: {
          closedAt,
          resultTally: tally,
          resultDigest: motionResultDigest({ ...motion, closedAt }, tally),
        },
      })
    }
    return motion.id
  }

  async function rows() {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transparency/motions?year=2026' })
    expect(res.statusCode).toBe(200)
    return res.json() as Row[]
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanup()
    const make = (name: string) =>
      createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `transparency-motions-${name}`,
        isMember: true,
      })
    proposerId = (await make('proposer')).id
    voterIds = [(await make('a')).id, (await make('b')).id, (await make('c')).id]
  })

  afterAll(async () => {
    await cleanup()
    await app.close()
  })

  it('publishes the certified result even after a vote row disappears', async () => {
    const id = await closedMotion('Certified', true)
    await prisma.vote.deleteMany({ where: { motionId: id, userId: voterIds[0]! } })
    const row = (await rows()).find((r) => r.id === id)
    expect(row).toMatchObject({ voteFor: 2, voteAgainst: 1, voteAbstain: 0 })
    expect(row?.tallySource).toBe('CERTIFICATE')
  })

  it("publishes the board's latest correction", async () => {
    const id = await closedMotion('Corrected', true)
    await prisma.motionResultCorrection.create({
      data: { motionId: id, note: 'Recount', tally: { YES: 1, NO: 1, ABSTAIN: 0 }, digest: 'x' },
    })
    await prisma.motionResultCorrection.create({
      data: {
        motionId: id,
        note: 'Confirmed',
        digest: 'y',
        createdAt: new Date(Date.now() + 1000),
      },
    })
    const row = (await rows()).find((r) => r.id === id)
    expect(row).toMatchObject({ voteFor: 1, voteAgainst: 1, tallySource: 'CORRECTION' })
  })

  it('counts the vote rows for a motion closed before certificates existed', async () => {
    const id = await closedMotion('Uncertified', false)
    const row = (await rows()).find((r) => r.id === id)
    expect(row).toMatchObject({ voteFor: 2, voteAgainst: 1, tallySource: 'LIVE' })
  })
})
