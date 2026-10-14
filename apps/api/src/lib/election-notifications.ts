// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { membersToNotify } from './motion-notifications.js'

/**
 * Tells every member that a board election takes nominations. A member could
 * only stand by finding the election on the governance page before the
 * deadline. Returns how many were told.
 */
export async function notifyMembersOfElectionOpened(
  prisma: PrismaClient,
  election: { id: string; title: string; nominationsCloseAt: Date | null },
  actorUserId: string,
): Promise<number> {
  const ids = await membersToNotify(prisma, actorUserId)
  if (ids.length === 0) return 0
  const until = election.nominationsCloseAt
    ? ` until ${election.nominationsCloseAt.toISOString().slice(0, 10)}`
    : ''
  await prisma.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: 'ELECTION_OPENED' as const,
      actorUserId,
      title: 'A board election takes nominations',
      body: `You can stand in "${election.title}"${until}.`,
      url: '/governance/elections',
    })),
  })
  return ids.length
}

/**
 * Tells each standing candidate the result of their election, whether or not
 * they were elected. The result was only on the governance page. Returns how
 * many were told.
 */
export async function notifyCandidatesOfElectionResult(
  prisma: PrismaClient,
  election: { title: string },
  candidates: Array<{ userId: string | null; elected: boolean; withdrawnAt: Date | null }>,
  actorUserId: string,
): Promise<number> {
  const standing = candidates.filter(
    (candidate): candidate is typeof candidate & { userId: string } =>
      candidate.userId !== null && candidate.withdrawnAt === null,
  )
  if (standing.length === 0) return 0
  await prisma.notification.createMany({
    data: standing.map((candidate) => ({
      userId: candidate.userId,
      type: 'ELECTION_RESULT' as const,
      actorUserId,
      title: candidate.elected ? 'You were elected' : 'An election you stood in is decided',
      body: candidate.elected
        ? `The meeting elected you in "${election.title}".`
        : `The result of "${election.title}" is recorded.`,
      url: '/governance/elections',
    })),
  })
  return standing.length
}
