// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export interface PlatformMetricSnapshot {
  registeredUsers: number
  activeUsersToday: number
  auditErrors24h: number
  storageUsedBytes: number
  storageQuotaBytes: number
  tracksTotal: number
  releasesPublishedTotal: number
  registrationsToday: number
}

const AUDIT_ERROR_ACTIONS = ['STRIPE_WEBHOOK_ERROR', 'DOWNLOAD_FRAUD_ALERT'] as const

function startOfUtcDay(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function bigintSum(value: bigint | number | null | undefined): number {
  if (value == null) return 0
  return typeof value === 'bigint' ? Number(value) : value
}

export async function collectPlatformMetrics(
  prisma: PrismaClient,
): Promise<PlatformMetricSnapshot> {
  const dayStart = startOfUtcDay()
  const auditSince = new Date(Date.now() - 86_400_000)

  const [
    registeredUsers,
    activeUsersToday,
    auditErrors24h,
    storageAgg,
    tracksTotal,
    releasesPublishedTotal,
    registrationsToday,
  ] = await Promise.all([
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
    prisma.userStorageQuota.aggregate({
      _sum: { usedBytes: true, quotaBytes: true },
    }),
    prisma.archiveItem.count(),
    prisma.release.count({ where: { state: 'PUBLISHED' } }),
    prisma.user.count({ where: { createdAt: { gte: dayStart } } }),
  ])

  return {
    registeredUsers,
    activeUsersToday,
    auditErrors24h,
    storageUsedBytes: bigintSum(storageAgg._sum.usedBytes),
    storageQuotaBytes: bigintSum(storageAgg._sum.quotaBytes),
    tracksTotal,
    releasesPublishedTotal,
    registrationsToday,
  }
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
    '# HELP tahti_storage_used_bytes Sum of user storage used bytes.',
    '# TYPE tahti_storage_used_bytes gauge',
    `tahti_storage_used_bytes ${snapshot.storageUsedBytes}`,
    '# HELP tahti_storage_quota_bytes Sum of user storage quota bytes.',
    '# TYPE tahti_storage_quota_bytes gauge',
    `tahti_storage_quota_bytes ${snapshot.storageQuotaBytes}`,
    '# HELP tahti_tracks_total Total archive items (tracks).',
    '# TYPE tahti_tracks_total gauge',
    `tahti_tracks_total ${snapshot.tracksTotal}`,
    '# HELP tahti_releases_published_total Published releases.',
    '# TYPE tahti_releases_published_total gauge',
    `tahti_releases_published_total ${snapshot.releasesPublishedTotal}`,
    '# HELP tahti_registrations_today Users registered since UTC midnight.',
    '# TYPE tahti_registrations_today gauge',
    `tahti_registrations_today ${snapshot.registrationsToday}`,
  ]
}
