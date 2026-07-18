// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export function currentQuarter(date = new Date()): { year: number; quarter: number } {
  return { year: date.getUTCFullYear(), quarter: Math.floor(date.getUTCMonth() / 3) + 1 }
}

function quarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 1)),
  }
}

export interface AssembledFeatureRequestQuarterlyReport {
  markdown: string
  votedInCount: number
}

export async function assembleFeatureRequestQuarterlyReportMarkdown(
  prisma: PrismaClient,
  year: number,
  quarter: number,
): Promise<AssembledFeatureRequestQuarterlyReport> {
  const { start, end } = quarterRange(year, quarter)

  const [votedIn, declined, duplicates, stillOpen] = await Promise.all([
    prisma.featureRequest.findMany({
      where: { votedInYear: year, votedInQuarter: quarter },
      orderBy: { reviewedAt: 'asc' },
      include: {
        _count: { select: { votes: true } },
        proposedBy: { select: { displayName: true } },
      },
    }),
    prisma.featureRequest.findMany({
      where: { status: 'DECLINED', reviewedAt: { gte: start, lt: end } },
      orderBy: { reviewedAt: 'asc' },
      include: {
        _count: { select: { votes: true } },
        proposedBy: { select: { displayName: true } },
      },
    }),
    prisma.featureRequest.findMany({
      where: { status: 'DUPLICATE', reviewedAt: { gte: start, lt: end } },
      orderBy: { reviewedAt: 'asc' },
      include: { mergedInto: { select: { title: true } } },
    }),
    prisma.featureRequest.findMany({
      where: { status: 'OPEN' },
      orderBy: { votes: { _count: 'desc' } },
      take: 15,
      include: { _count: { select: { votes: true } } },
    }),
  ])

  const lines: string[] = [
    `# Tahti ry — Feature request review Q${quarter} ${year}`,
    '',
    `_Generated ${new Date().toISOString().slice(0, 10)}._`,
    '',
    '## Voted in this quarter',
    '',
  ]

  if (votedIn.length === 0) {
    lines.push('_No feature requests were voted in this quarter._', '')
  } else {
    for (const f of votedIn) {
      lines.push(
        `- **${f.title}** (${f._count.votes} vote${f._count.votes === 1 ? '' : 's'}) — ${f.status} — proposed by ${f.proposedBy.displayName}${f.reviewNote ? ` — _${f.reviewNote}_` : ''}`,
      )
    }
    lines.push('')
  }

  lines.push('## Declined this quarter', '')
  if (declined.length === 0) {
    lines.push('_None._', '')
  } else {
    for (const f of declined) {
      lines.push(
        `- **${f.title}** (${f._count.votes} vote${f._count.votes === 1 ? '' : 's'})${f.reviewNote ? ` — _${f.reviewNote}_` : ''}`,
      )
    }
    lines.push('')
  }

  lines.push('## Closed as duplicate this quarter', '')
  if (duplicates.length === 0) {
    lines.push('_None._', '')
  } else {
    for (const f of duplicates) {
      lines.push(`- **${f.title}** → merged into **${f.mergedInto?.title ?? '(deleted)'}**`)
    }
    lines.push('')
  }

  lines.push('## Still open, awaiting review (top by votes)', '')
  if (stillOpen.length === 0) {
    lines.push('_None._', '')
  } else {
    for (const f of stillOpen) {
      lines.push(`- **${f.title}** (${f._count.votes} vote${f._count.votes === 1 ? '' : 's'})`)
    }
    lines.push('')
  }

  return { markdown: lines.join('\n'), votedInCount: votedIn.length }
}

export function featureRequestQuarterlyReportStorageKey(year: number, quarter: number): string {
  return `transparency/reports/${year}/feature-requests-q${quarter}.md`
}
