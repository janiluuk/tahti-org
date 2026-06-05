// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export interface PlatformMetricSnapshot {
  registeredUsers: number
  activeUsersToday: number
  auditErrors24h: number
}

const AUDIT_ERROR_ACTIONS = ['STRIPE_WEBHOOK_ERROR', 'DOWNLOAD_FRAUD_ALERT'] as const

function startOfUtcDay(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function collectPlatformMetrics(
  prisma: PrismaClient,
): Promise<PlatformMetricSnapshot> {
  const dayStart = startOfUtcDay()
  const auditSince = new Date(Date.now() - 86_400_000)

  const [registeredUsers, activeUsersToday, auditErrors24h] = await Promise.all([
    prisma.user.count(),
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT "userId")::bigint AS count
      FROM core."Session"
      WHERE "createdAt" >= ${dayStart}
    `.then((rows) => Number(rows[0]?.count ?? 0)),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: auditSince },
        action: { in: [...AUDIT_ERROR_ACTIONS] },
      },
    }),
  ])

  return { registeredUsers, activeUsersToday, auditErrors24h }
}

export function renderPlatformMetricLines(snapshot: PlatformMetricSnapshot): string[] {
  return [
    '# HELP tahti_users_registered_total Registered user accounts.',
    '# TYPE tahti_users_registered_total gauge',
    `tahti_users_registered_total ${snapshot.registeredUsers}`,
    '# HELP tahti_users_active_today Distinct users with a new session since UTC midnight.',
    '# TYPE tahti_users_active_today gauge',
    `tahti_users_active_today ${snapshot.activeUsersToday}`,
    '# HELP tahti_audit_errors_24h Audit log entries (webhook/fraud) in the last 24 hours.',
    '# TYPE tahti_audit_errors_24h gauge',
    `tahti_audit_errors_24h ${snapshot.auditErrors24h}`,
  ]
}
