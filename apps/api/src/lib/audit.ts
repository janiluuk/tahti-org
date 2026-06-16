// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

interface AuditParams {
  action:
    | 'CHAT_BAN'
    | 'CHAT_UNBAN'
    | 'CHAT_MESSAGE_DELETE'
    | 'STREAM_KEY_ROTATE'
    | 'RTMP_TARGET_ADD'
    | 'RTMP_TARGET_DELETE'
    | 'LEDGER_ENTRY_CREATE'
    | 'MEMBER_SUSPEND'
    | 'MEMBER_REINSTATE'
    | 'MOTION_CREATE'
    | 'MOTION_OPEN'
    | 'MOTION_CLOSE'
    | 'VOTE_CAST'
    | 'GRANT_RUN'
    | 'STRIPE_WEBHOOK_ERROR'
    | 'DOWNLOAD_FRAUD_ALERT'
    | 'MEMBERSHIP_RENEWAL_REMINDER'
    | 'MEMBERSHIP_LAPSED'
    | 'USER_SUSPEND'
    | 'USER_UNSUSPEND'
    | 'BOARD_ROLE_CHANGE'
    | 'ENGAGEMENT_ADJUSTMENT'
    | 'STREAM_FORCE_OFFLINE'
    | 'ACCOUNT_DELETE'
    | 'ARCHIVE_EDIT_RENDER'
    | 'ARCHIVE_EDIT_BOUNCE'
  actorId: string
  targetId?: string
  meta?: Record<string, unknown>
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
