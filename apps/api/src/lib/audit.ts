// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

interface AuditParams {
  action:
    | 'CHAT_BAN'
    | 'CHAT_UNBAN'
    | 'CHAT_MESSAGE_DELETE'
    | 'CHAT_MESSAGE_SEND'
    | 'STREAM_KEY_ROTATE'
    | 'RTMP_TARGET_ADD'
    | 'RTMP_TARGET_DELETE'
    | 'LEDGER_ENTRY_CREATE'
    | 'MEMBER_SUSPEND'
    | 'MEMBER_REINSTATE'
    | 'MOTION_CREATE'
    | 'MOTION_OPEN'
    | 'MOTION_CLOSE'
    | 'MOTION_COMMENT_CREATE'
    | 'VOTE_CAST'
    | 'GRANT_RUN'
    | 'STRIPE_WEBHOOK_ERROR'
    | 'DOWNLOAD_FRAUD_ALERT'
    | 'MEMBERSHIP_RENEWAL_REMINDER'
    | 'MEMBERSHIP_LAPSED'
    | 'USER_SUSPEND'
    | 'USER_UNSUSPEND'
    | 'BOARD_ROLE_CHANGE'
    | 'USER_TIER_CHANGE'
    | 'ENGAGEMENT_ADJUSTMENT'
    | 'STREAM_FORCE_OFFLINE'
    | 'STREAM_RESTART'
    | 'ACCOUNT_DELETE'
    | 'ARCHIVE_EDIT_RENDER'
    | 'ARCHIVE_EDIT_BOUNCE'
    | 'ARCHIVE_EDIT_PUBLISH'
    | 'FEATURE_REQUEST_CREATE'
    | 'FEATURE_REQUEST_VOTE'
    | 'FEATURE_REQUEST_UNVOTE'
    | 'FEATURE_REQUEST_COMMENT_CREATE'
    | 'FEATURE_REQUEST_STATUS_UPDATE'
    | 'FEATURE_REQUEST_QUARTERLY_REPORT'
    | 'ARCHIVE_METADATA_ADMIN_EDIT'
    | 'API_TOKEN_CREATE'
    | 'API_TOKEN_REVOKE'
    | 'USER_LOGIN'
    | 'USER_REGISTER'
    | 'CONTENT_UPLOAD'
    | 'RELEASE_PUBLISH'
    | 'ARCHIVE_ITEM_LIKE'
    | 'ARTIST_FOLLOW'
    | 'FAN_SUBSCRIPTION_CREATE'
    | 'RADIO_SLOT_BOOKING_CREATE'
    | 'RADIO_SLOT_BOOKING_UPDATE'
    | 'RADIO_SLOT_BOOKING_CANCEL'
    | 'CHANNEL_GO_LIVE'
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
