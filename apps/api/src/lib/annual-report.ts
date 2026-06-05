// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

const CATEGORY_LABELS: Record<string, string> = {
  REVENUE_SUBSCRIPTION: 'Member subscriptions',
  REVENUE_DISTRIBUTION: 'Distribution fees',
  REVENUE_GRANT_INBOUND: 'Grant income',
  REVENUE_DONATION: 'Donations',
  COST_INFRASTRUCTURE: 'Infrastructure',
  COST_DISTRIBUTION_PASSTHROUGH: 'Distribution pass-through',
  COST_OPERATIONS: 'Operations',
  COST_SALARY: 'Salaries',
  COST_AUDIT: 'Audit & accounting',
  COST_PROFESSIONAL_SERVICES: 'Professional services',
  GRANT_DISBURSEMENT: 'Artist grants paid out',
  RESERVE_TRANSFER: 'Reserve transfers',
}

function formatEur(cents: bigint | number): string {
  const n = typeof cents === 'bigint' ? Number(cents) : cents
  return `€${(n / 100).toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface AssembledAnnualReport {
  markdown: string
  stats: {
    totalRevenueCents: bigint
    totalCostsCents: bigint
    surplusCents: bigint
    grantTotalCents: bigint
    memberTotal: number
    fanSubCount: number
  }
}

export async function assembleAnnualReportMarkdown(
  prisma: PrismaClient,
  year: number,
): Promise<AssembledAnnualReport> {
  const yearStr = String(year)
  const rollups = await prisma.monthlyRollup.findMany({
    where: { yearMonth: { startsWith: `${yearStr}-` } },
    select: { byCategory: true, surplus: true },
  })

  const totals: Record<string, bigint> = {}
  let surplusCents = 0n
  for (const r of rollups) {
    surplusCents += r.surplus
    const cats = r.byCategory as Record<string, number>
    for (const [cat, amt] of Object.entries(cats)) {
      totals[cat] = (totals[cat] ?? 0n) + BigInt(amt)
    }
  }

  const revenueKeys = Object.keys(totals).filter((k) => k.startsWith('REVENUE_'))
  const costKeys = Object.keys(totals).filter((k) => k.startsWith('COST_'))
  const otherKeys = Object.keys(totals).filter(
    (k) => !k.startsWith('REVENUE_') && !k.startsWith('COST_'),
  )

  const totalRevenueCents = revenueKeys.reduce((s, k) => s + (totals[k] ?? 0n), 0n)
  const totalCostsCents = costKeys.reduce((s, k) => s + (totals[k] ?? 0n), 0n)

  const grants = await prisma.grantDisbursement.findMany({
    where: { forYear: year },
    orderBy: { amountCents: 'desc' },
    select: { publishedAs: true, units: true, amountCents: true, state: true },
  })
  const grantTotalCents = grants.reduce((s, g) => s + g.amountCents, 0n)

  const yearStart = new Date(Date.UTC(year, 0, 1))
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1))

  const [memberTotal, newMembers, lapsed, boardCount, fanSubCount, liveHoursAgg, archiveCount] =
    await Promise.all([
      prisma.user.count({ where: { isMember: true } }),
      prisma.user.count({
        where: { isMember: true, memberSince: { gte: yearStart, lt: yearEnd } },
      }),
      prisma.auditLog.count({
        where: { action: 'MEMBERSHIP_LAPSED', createdAt: { gte: yearStart, lt: yearEnd } },
      }),
      prisma.user.count({ where: { isBoard: true } }),
      prisma.fanSubscription.count({ where: { state: 'ACTIVE' } }),
      prisma.channel.aggregate({ _sum: { totalLiveHours: true } }),
      prisma.archiveItem.count({
        where: { releasedAt: { gte: yearStart, lt: yearEnd } },
      }),
    ])

  const resolutions = await prisma.boardResolution.findMany({
    where: {
      publishedAt: { not: null },
      votedAt: { gte: yearStart, lt: yearEnd },
      outcome: 'PASSED',
    },
    orderBy: { votedAt: 'asc' },
    select: {
      title: true,
      body: true,
      votedAt: true,
      voteFor: true,
      voteAgainst: true,
      voteAbstain: true,
    },
  })

  const lines: string[] = [
    `# Tahti ry — Annual transparency report ${year}`,
    '',
    `_Generated ${new Date().toISOString().slice(0, 10)}. Tahti ry, Y-tunnus 3368171-8._`,
    '',
    '## 1. Financial summary',
    '',
    `| | Amount |`,
    `|---|---|`,
    `| Total revenue | ${formatEur(totalRevenueCents)} |`,
    `| Total costs | ${formatEur(totalCostsCents)} |`,
    `| Running surplus | ${formatEur(surplusCents)} |`,
    '',
  ]

  if (revenueKeys.length > 0) {
    lines.push('### Revenue', '')
    for (const k of revenueKeys.sort()) {
      lines.push(`- **${CATEGORY_LABELS[k] ?? k}:** ${formatEur(totals[k] ?? 0n)}`)
    }
    lines.push('')
  }

  if (costKeys.length > 0) {
    lines.push('### Costs', '')
    for (const k of costKeys.sort()) {
      lines.push(`- **${CATEGORY_LABELS[k] ?? k}:** ${formatEur(totals[k] ?? 0n)}`)
    }
    lines.push('')
  }

  if (otherKeys.length > 0) {
    lines.push('### Other ledger categories', '')
    for (const k of otherKeys.sort()) {
      lines.push(`- **${CATEGORY_LABELS[k] ?? k}:** ${formatEur(totals[k] ?? 0n)}`)
    }
    lines.push('')
  }

  lines.push('## 2. Grant disbursement', '')
  lines.push(
    `Total disbursed: **${formatEur(grantTotalCents)}** across **${grants.length}** artist${grants.length === 1 ? '' : 's'}.`,
    '',
  )
  if (grants.length > 0) {
    lines.push('| Artist | Units | Amount | State |', '|---|---:|---:|---|')
    for (const g of grants) {
      lines.push(`| ${g.publishedAs} | ${g.units} | ${formatEur(g.amountCents)} | ${g.state} |`)
    }
    lines.push('')
  }

  lines.push('## 3. Member statistics', '')
  lines.push(`- Active members (current): **${memberTotal}**`)
  lines.push(`- New members in ${year}: **${newMembers}**`)
  lines.push(`- Lapsed in ${year}: **${lapsed}**`)
  lines.push(`- Board members (current): **${boardCount}**`)
  lines.push('')

  lines.push('## 4. Platform metrics', '')
  lines.push(`- Active fan subscriptions: **${fanSubCount}**`)
  lines.push(
    `- Cumulative channel live hours (all time): **${(liveHoursAgg._sum.totalLiveHours ?? 0).toFixed(1)}**`,
  )
  lines.push(`- Archive items published in ${year}: **${archiveCount}**`)
  lines.push('')

  lines.push('## 5. Board resolutions', '')
  if (resolutions.length === 0) {
    lines.push('_No published resolutions passed during this year._', '')
  } else {
    for (const r of resolutions) {
      lines.push(
        `### ${r.title}`,
        '',
        `_Voted ${r.votedAt.toISOString().slice(0, 10)} — ${r.voteFor}/${r.voteAgainst}/${r.voteAbstain} (for/against/abstain)_`,
        '',
        r.body,
        '',
      )
    }
  }

  return {
    markdown: lines.join('\n'),
    stats: {
      totalRevenueCents,
      totalCostsCents,
      surplusCents,
      grantTotalCents,
      memberTotal,
      fanSubCount,
    },
  }
}

export function annualReportStorageKey(year: number): string {
  return `transparency/reports/${year}/annual-report.md`
}
