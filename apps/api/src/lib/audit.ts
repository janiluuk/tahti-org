// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { AuditAction, PrismaClient } from '@tahti/db'
import {
  isSecretBallotAuditAction,
  redactSecretBallotAuditMeta,
  topicForAuditAction,
} from '@tahti/shared'

interface AuditParams {
  action: AuditAction
  actorId: string
  targetId?: string
  meta?: Record<string, unknown>
}

export function presentAuditLogRow(
  row: {
    id: { toString(): string }
    action: string
    actorId: string
    targetId: string | null
    meta: unknown
    createdAt: Date
  },
  actor?: { displayName: string | null; username: string | null } | null,
) {
  const secret = isSecretBallotAuditAction(row.action)
  const rawMeta =
    row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
      ? (row.meta as Record<string, unknown>)
      : {}
  return {
    id: row.id.toString(),
    action: row.action,
    actorId: secret ? 'hidden' : row.actorId,
    targetId: row.targetId,
    meta: redactSecretBallotAuditMeta(row.action, rawMeta),
    createdAt: row.createdAt,
    actorDisplayName: secret ? null : (actor?.displayName ?? null),
    actorUsername: secret ? null : (actor?.username ?? null),
    topic: topicForAuditAction(row.action),
  }
}

export async function auditLog(prisma: PrismaClient, params: AuditParams): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        action: params.action,
        actorId: params.actorId,
        targetId: params.targetId,
        meta: (params.meta ?? {}) as object,
      },
    })
    .catch((err: unknown) => {
      // Audit failures must not break the primary operation — log and continue
      console.error('[audit] failed to write audit log:', err)
    })
}

export async function auditUserTierChange(
  prisma: PrismaClient,
  params: {
    actorId: string
    targetId: string
    from: string
    to: string
    reason?: string
  },
): Promise<void> {
  if (params.from === params.to) {
    return
  }
  await auditLog(prisma, {
    action: 'USER_TIER_CHANGE',
    actorId: params.actorId,
    targetId: params.targetId,
    meta: {
      from: params.from,
      to: params.to,
      ...(params.reason ? { reason: params.reason } : {}),
    },
  })
}
