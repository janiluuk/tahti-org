// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

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
