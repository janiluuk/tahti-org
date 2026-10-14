// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Prisma } from '@tahti/db'

type Db = Pick<Prisma.TransactionClient, 'governanceBoardTerm'>

/** Terms that overlap [start, end). An open end runs forever. */
function overlapping(start: Date, end: Date | null) {
  return [
    ...(end ? [{ termStart: { lt: end } }] : []),
    { OR: [{ termEnd: null }, { termEnd: { gt: start } }] },
  ]
}

/**
 * Why a new term would clash with a recorded one, or null. One person holds
 * one role at a time, and there is one chair.
 */
export async function boardTermClash(
  db: Db,
  term: { userId: string; role: string; termStart: Date; termEnd: Date | null },
): Promise<string | null> {
  const clash = await db.governanceBoardTerm.findFirst({
    where: {
      AND: [
        ...overlapping(term.termStart, term.termEnd),
        {
          OR: [
            { userId: term.userId },
            ...(term.role === 'CHAIR' ? [{ role: 'CHAIR' as const }] : []),
          ],
        },
      ],
    },
    select: { id: true },
  })
  if (!clash) return null
  return term.role === 'CHAIR'
    ? 'That term overlaps another chair or another term of this member'
    : 'That term overlaps another term of this member'
}
