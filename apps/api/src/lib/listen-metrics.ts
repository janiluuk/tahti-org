// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export interface ListenMetricSnapshot {
  minutesListened24h: number
  bySource24h: Array<{ source: string; minutes: number }>
  byCountry24h: Array<{ countryCode: string; minutes: number }>
}

const TOP_N = 10

/** Only counts *closed* sessions (endedAt set) that started in the last 24h —
 * an in-progress session's minutes show up once the listen-session-close
 * cron closes it (within ~2 minutes of the listener actually stopping), not
 * before. Simpler and avoids double-counting vs. summing partial durations
 * for open sessions too. */
export async function collectListenMetrics(prisma: PrismaClient): Promise<ListenMetricSnapshot> {
  const since = new Date(Date.now() - 86_400_000)

  const [totalRow, bySource, byCountry] = await Promise.all([
    prisma.$queryRaw<[{ minutes: number | null }]>`
      SELECT SUM(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60)::float8 AS minutes
      FROM "engagement"."ListenSession"
      WHERE "startedAt" >= ${since} AND "endedAt" IS NOT NULL
    `,
    prisma.$queryRaw<Array<{ source: string; minutes: number | null }>>`
      SELECT "source", SUM(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60)::float8 AS minutes
      FROM "engagement"."ListenSession"
      WHERE "startedAt" >= ${since} AND "endedAt" IS NOT NULL
      GROUP BY "source"
    `,
    prisma.$queryRaw<Array<{ countryCode: string; minutes: number | null }>>`
      SELECT "countryCode", SUM(EXTRACT(EPOCH FROM ("endedAt" - "startedAt")) / 60)::float8 AS minutes
      FROM "engagement"."ListenSession"
      WHERE "startedAt" >= ${since} AND "endedAt" IS NOT NULL AND "countryCode" IS NOT NULL
      GROUP BY "countryCode"
      ORDER BY minutes DESC
      LIMIT ${TOP_N}
    `,
  ])

  const round2 = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100

  return {
    minutesListened24h: round2(totalRow[0]?.minutes),
    bySource24h: bySource
      .map((row) => ({ source: row.source, minutes: round2(row.minutes) }))
      .sort((a, b) => b.minutes - a.minutes),
    byCountry24h: byCountry.map((row) => ({
      countryCode: row.countryCode,
      minutes: round2(row.minutes),
    })),
  }
}

/** Prometheus label values must not contain unescaped quotes/backslashes/newlines. */
function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

export function renderListenMetricLines(snapshot: ListenMetricSnapshot): string[] {
  const lines = [
    '# HELP tahti_listen_minutes_24h Total listen-minutes (closed sessions) started in the last 24 hours.',
    '# TYPE tahti_listen_minutes_24h gauge',
    `tahti_listen_minutes_24h ${snapshot.minutesListened24h}`,
    '# HELP tahti_listen_minutes_by_source_24h Listen-minutes in the last 24 hours, by originating surface.',
    '# TYPE tahti_listen_minutes_by_source_24h gauge',
  ]
  for (const row of snapshot.bySource24h) {
    lines.push(
      `tahti_listen_minutes_by_source_24h{source="${escapeLabel(row.source)}"} ${row.minutes}`,
    )
  }
  lines.push(
    '# HELP tahti_listen_minutes_by_country_24h Listen-minutes in the last 24 hours, by listener country (top 10).',
    '# TYPE tahti_listen_minutes_by_country_24h gauge',
  )
  for (const row of snapshot.byCountry24h) {
    lines.push(
      `tahti_listen_minutes_by_country_24h{country="${escapeLabel(row.countryCode)}"} ${row.minutes}`,
    )
  }
  return lines
}
