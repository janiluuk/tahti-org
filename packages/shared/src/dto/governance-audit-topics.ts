// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/**
 * Board-facing governance audit topics. Ops noise (chat, stream keys, likes,
 * logins) stays off `/admin/governance/audit`. System logs remain on
 * `/admin/logs`.
 */
export const GOVERNANCE_AUDIT_TOPIC_IDS = [
  'finance',
  'subscriptions',
  'membership',
  'decisions',
  'officers',
  'meetings',
  'radio',
  'notices',
  'minutes',
  'official-votes',
] as const

export type GovernanceAuditTopicId = (typeof GOVERNANCE_AUDIT_TOPIC_IDS)[number]

export const GovernanceAuditTopicIdSchema = z.enum(GOVERNANCE_AUDIT_TOPIC_IDS)

export const GovernanceAuditScopeSchema = z.enum(['governance', 'all']).default('governance')

export type GovernanceAuditTopic = {
  id: GovernanceAuditTopicId
  label: string
  description: string
  actions: readonly string[]
}

export const GOVERNANCE_AUDIT_TOPICS: readonly GovernanceAuditTopic[] = [
  {
    id: 'finance',
    label: 'Finance & grants',
    description:
      'Ledger entries, grant rounds, engagement-unit adjustments, Stripe webhook failures, and download fraud alerts.',
    actions: [
      'LEDGER_ENTRY_CREATE',
      'GRANT_RUN',
      'ENGAGEMENT_ADJUSTMENT',
      'STRIPE_WEBHOOK_ERROR',
      'DOWNLOAD_FRAUD_ALERT',
    ],
  },
  {
    id: 'subscriptions',
    label: 'Fan subscriptions',
    description: 'Paid fan-sub starts that affect association revenue sharing.',
    actions: ['FAN_SUBSCRIPTION_CREATE'],
  },
  {
    id: 'membership',
    label: 'Membership & register',
    description:
      'Member suspend/reinstate, renewal reminders, lapses, account deletion, and membership-tier changes.',
    actions: [
      'MEMBER_SUSPEND',
      'MEMBER_REINSTATE',
      'MEMBERSHIP_RENEWAL_REMINDER',
      'MEMBERSHIP_LAPSED',
      'ACCOUNT_DELETE',
      'USER_TIER_CHANGE',
    ],
  },
  {
    id: 'decisions',
    label: 'Motions & advisory votes',
    description:
      'Advisory motion lifecycle, comments, vote records (ballot choices redacted), and quarterly feature reports. Board-recorded resolutions live under Official meeting votes.',
    actions: [
      'MOTION_CREATE',
      'MOTION_OPEN',
      'MOTION_CLOSE',
      'MOTION_COMMENT_CREATE',
      'VOTE_CAST',
      'VOTE_CHANGE',
      'VOTE_RETRACT',
      'FEATURE_REQUEST_QUARTERLY_REPORT',
    ],
  },
  {
    id: 'officers',
    label: 'Board & roles',
    description: 'Board-role grants/revokes and account suspensions.',
    actions: ['BOARD_ROLE_CHANGE', 'USER_SUSPEND', 'USER_UNSUSPEND'],
  },
  {
    id: 'meetings',
    label: 'Meetings & documents',
    description:
      'AGM/board meeting create/update, attendance, official document archive writes, and yearly report generation.',
    actions: [
      'MEETING_CREATE',
      'MEETING_UPDATE',
      'MEETING_ATTENDANCE_UPSERT',
      'DOCUMENT_CREATE',
      'ANNUAL_REPORT_GENERATE',
    ],
  },
  {
    id: 'radio',
    label: 'Radio bookings',
    description: 'Scheduled radio slot bookings that allocate association airtime.',
    actions: [
      'RADIO_SLOT_BOOKING_CREATE',
      'RADIO_SLOT_BOOKING_UPDATE',
      'RADIO_SLOT_BOOKING_CANCEL',
    ],
  },
  {
    id: 'notices',
    label: 'Notices & delivery',
    description:
      'Meeting notice publication (notice date set or changed). Only publication is audited so far — per-recipient send/bounce/open evidence is not yet tracked; see remaining-work.md.',
    actions: ['MEETING_NOTICE_PUBLISH'],
  },
  {
    id: 'minutes',
    label: 'Minutes workflow',
    description:
      'Upload, approval, and signature as distinct audited steps. Redaction and a separate publish step are not yet modeled — see the planned "Conflicts & recusals" note and remaining-work.md.',
    actions: ['MINUTES_UPLOAD', 'MINUTES_APPROVE', 'MINUTES_SIGN'],
  },
  {
    id: 'official-votes',
    label: 'Official meeting votes',
    description:
      'Board-recorded resolutions and outcomes, distinct from advisory member motions. Not yet linked to a specific meeting record or flagged binding vs. advisory at the schema level.',
    actions: ['RESOLUTION_CREATE', 'RESOLUTION_UPDATE'],
  },
]

export const GOVERNANCE_AUDIT_PLANNED_TOPICS = [
  {
    id: 'conflicts',
    label: 'Conflicts & recusals',
    description:
      'Declared conflicts of interest and recusals on motions or meeting votes (no data model yet).',
  },
] as const

export const GOVERNANCE_AUDIT_ACTION_LABELS: Record<string, string> = {
  LEDGER_ENTRY_CREATE: 'Ledger entry created',
  GRANT_RUN: 'Grant round run',
  ENGAGEMENT_ADJUSTMENT: 'Engagement units adjusted',
  STRIPE_WEBHOOK_ERROR: 'Stripe webhook error',
  DOWNLOAD_FRAUD_ALERT: 'Download fraud alert',
  FAN_SUBSCRIPTION_CREATE: 'Fan subscription started',
  MEMBER_SUSPEND: 'Member suspended',
  MEMBER_REINSTATE: 'Member reinstated',
  MEMBERSHIP_RENEWAL_REMINDER: 'Membership renewal reminder',
  MEMBERSHIP_LAPSED: 'Membership lapsed',
  ACCOUNT_DELETE: 'Account deleted',
  USER_TIER_CHANGE: 'Membership tier changed',
  MOTION_CREATE: 'Motion created',
  MOTION_OPEN: 'Motion opened',
  MOTION_CLOSE: 'Motion closed',
  MOTION_COMMENT_CREATE: 'Motion comment posted',
  VOTE_CAST: 'Vote recorded',
  VOTE_CHANGE: 'Vote changed',
  VOTE_RETRACT: 'Vote retracted',
  RESOLUTION_CREATE: 'Board resolution recorded',
  RESOLUTION_UPDATE: 'Board resolution updated',
  FEATURE_REQUEST_QUARTERLY_REPORT: 'Quarterly feature report generated',
  BOARD_ROLE_CHANGE: 'Board role changed',
  USER_SUSPEND: 'Account suspended',
  USER_UNSUSPEND: 'Suspension lifted',
  MEETING_CREATE: 'Meeting created',
  MEETING_UPDATE: 'Meeting updated',
  MEETING_ATTENDANCE_UPSERT: 'Meeting attendance updated',
  DOCUMENT_CREATE: 'Governance document created',
  ANNUAL_REPORT_GENERATE: 'Annual report generated',
  RADIO_SLOT_BOOKING_CREATE: 'Radio slot booked',
  RADIO_SLOT_BOOKING_UPDATE: 'Radio slot updated',
  RADIO_SLOT_BOOKING_CANCEL: 'Radio slot cancelled',
  MEETING_NOTICE_PUBLISH: 'Meeting notice published',
  MINUTES_UPLOAD: 'Minutes uploaded',
  MINUTES_APPROVE: 'Minutes approved',
  MINUTES_SIGN: 'Minutes signed',
}

const TOPIC_BY_ACTION = new Map<string, GovernanceAuditTopicId>()
for (const topic of GOVERNANCE_AUDIT_TOPICS) {
  for (const action of topic.actions) {
    TOPIC_BY_ACTION.set(action, topic.id)
  }
}

export const GOVERNANCE_AUDIT_ACTIONS: readonly string[] = [...TOPIC_BY_ACTION.keys()]

export function isGovernanceAuditTopicId(value: string): value is GovernanceAuditTopicId {
  return (GOVERNANCE_AUDIT_TOPIC_IDS as readonly string[]).includes(value)
}

export function topicForAuditAction(action: string): GovernanceAuditTopicId | null {
  return TOPIC_BY_ACTION.get(action) ?? null
}

export function governanceAuditTopicById(id: string): GovernanceAuditTopic | undefined {
  return GOVERNANCE_AUDIT_TOPICS.find((topic) => topic.id === id)
}

export function actionsForGovernanceAuditTopic(topicId?: string): readonly string[] | null {
  if (!topicId) return GOVERNANCE_AUDIT_ACTIONS
  const topic = governanceAuditTopicById(topicId)
  return topic ? topic.actions : null
}

export function governanceAuditActionLabel(action: string): string {
  return GOVERNANCE_AUDIT_ACTION_LABELS[action] ?? action
}

const SECRET_BALLOT_ACTIONS = new Set(['VOTE_CAST', 'VOTE_CHANGE', 'VOTE_RETRACT'])

export function isSecretBallotAuditAction(action: string): boolean {
  return SECRET_BALLOT_ACTIONS.has(action)
}

export function redactSecretBallotAuditMeta(
  action: string,
  meta: Record<string, unknown>,
): Record<string, unknown> {
  if (!isSecretBallotAuditAction(action)) return meta
  return { ballot: 'secret' }
}

export type GovernanceAuditLogLine = {
  source: string
  title: string
  detail: string
}

export function describeGovernanceAuditItem(item: {
  action: string
  actorDisplayName: string | null
  actorUsername: string | null
  actorId: string
  targetId: string | null
  meta: Record<string, unknown>
}): GovernanceAuditLogLine {
  const topicId = topicForAuditAction(item.action)
  const topic = topicId ? governanceAuditTopicById(topicId) : undefined
  const actor =
    isSecretBallotAuditAction(item.action) || item.actorId === 'hidden'
      ? 'ballot hidden'
      : (item.actorDisplayName ?? item.actorUsername ?? item.actorId.slice(0, 8))
  const meta = redactSecretBallotAuditMeta(item.action, item.meta)
  const metaText = Object.keys(meta).length > 0 ? ` · ${JSON.stringify(meta)}` : ''
  const target = item.targetId ? ` · target ${item.targetId}` : ''
  return {
    source: topic?.label ?? 'Other',
    title: governanceAuditActionLabel(item.action),
    detail: `${actor}${target}${metaText}`,
  }
}
