// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export type GovernanceRecordKind =
  'MEETING' | 'DOCUMENT' | 'RESOLUTION' | 'MOTION' | 'ANNUAL_REPORT'

/**
 * Whether a member can see the record: the same rules as the member lists
 * (an announced meeting, a published document or resolution, a motion past
 * DRAFT, a published yearly report). A resolution is named by its number and
 * a yearly report by its year.
 */
export async function memberCanSeeRecord(
  prisma: PrismaClient,
  kind: GovernanceRecordKind,
  id: string,
): Promise<boolean> {
  const numeric = /^\d{1,18}$/.test(id)
  switch (kind) {
    case 'MEETING':
      return (await prisma.governanceMeeting.count({ where: { id, state: { not: 'DRAFT' } } })) > 0
    case 'DOCUMENT':
      return (
        (await prisma.governanceDocument.count({ where: { id, publishedAt: { not: null } } })) > 0
      )
    case 'MOTION':
      return (await prisma.motion.count({ where: { id, state: { not: 'DRAFT' } } })) > 0
    case 'RESOLUTION':
      return (
        numeric &&
        (await prisma.boardResolution.count({
          where: { id: BigInt(id), publishedAt: { not: null } },
        })) > 0
      )
    case 'ANNUAL_REPORT':
      return (
        numeric &&
        id.length === 4 &&
        (await prisma.annualReport.count({
          where: { year: Number(id), publishedAt: { not: null } },
        })) > 0
      )
  }
}
