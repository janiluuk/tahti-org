// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import type { PrismaClient } from '@tahti/db'

export type MotionTally = { YES: number; NO: number; ABSTAIN: number }

type CertifiedMotion = {
  id: string
  title: string
  description: string
  advisory: boolean
  openAt: Date
  closeAt: Date
  closedAt: Date
  eligibleMemberCount: number | null
}

/** The digest printed on a result certificate. The field order is fixed
 * here, so the same motion and tally always give the same digest. */
export function motionResultDigest(motion: CertifiedMotion, tally: MotionTally): string {
  const canonical = JSON.stringify([
    motion.id,
    motion.title,
    motion.description,
    motion.advisory,
    motion.openAt.toISOString(),
    motion.closeAt.toISOString(),
    motion.closedAt.toISOString(),
    motion.eligibleMemberCount,
    tally.YES,
    tally.NO,
    tally.ABSTAIN,
  ])
  return createHash('sha256').update(canonical).digest('hex')
}

export async function countMotionVotes(
  prisma: PrismaClient,
  motionId: string,
): Promise<MotionTally> {
  const rows = await prisma.vote.groupBy({
    by: ['choice'],
    where: { motionId },
    _count: { _all: true },
  })
  const tally: MotionTally = { YES: 0, NO: 0, ABSTAIN: 0 }
  for (const row of rows) tally[row.choice] = row._count._all
  return tally
}

/** Fixes the result of a motion that has just been closed. Does nothing if
 * a certificate already exists. */
export async function issueMotionCertificate(
  prisma: PrismaClient,
  motionId: string,
): Promise<void> {
  const motion = await prisma.motion.findUnique({ where: { id: motionId } })
  if (!motion || motion.state !== 'CLOSED' || motion.resultDigest) return
  const closedAt = new Date()
  const tally = await countMotionVotes(prisma, motionId)
  await prisma.motion.updateMany({
    where: { id: motionId, resultDigest: null },
    data: {
      closedAt,
      resultTally: tally,
      resultDigest: motionResultDigest({ ...motion, closedAt }, tally),
    },
  })
}
