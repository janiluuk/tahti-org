// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Canonical Revelator delivery statuses stored on `Release.revelatorStatus`. */
export const REVELATOR_STATUSES = ['pending', 'submitted', 'delivered', 'failed'] as const
export type RevelatorStatus = (typeof REVELATOR_STATUSES)[number]

const STATUS_RANK: Record<RevelatorStatus, number> = {
  pending: 1,
  submitted: 2,
  delivered: 3,
  failed: 0,
}

/**
 * Map provider webhook `status` / `event` strings onto our four DB values.
 * Unknown values return null (caller should 400, not clear existing status).
 */
export function mapRevelatorWebhookStatus(
  status?: string | null,
  event?: string | null,
): RevelatorStatus | null {
  const raw = (status ?? event ?? '').trim().toLowerCase()
  if (!raw) return null
  if (
    raw === 'delivered' ||
    raw === 'live' ||
    raw === 'completed' ||
    raw === 'delivery.completed' ||
    raw.endsWith('.delivered') ||
    raw.endsWith('.completed')
  ) {
    return 'delivered'
  }
  if (
    raw === 'failed' ||
    raw === 'rejected' ||
    raw === 'error' ||
    raw.endsWith('.failed') ||
    raw.endsWith('.rejected')
  ) {
    return 'failed'
  }
  if (
    raw === 'submitted' ||
    raw === 'processing' ||
    raw === 'in_progress' ||
    raw === 'in-progress' ||
    raw.endsWith('.submitted') ||
    raw.endsWith('.processing')
  ) {
    return 'submitted'
  }
  if (raw === 'pending' || raw === 'queued' || raw.endsWith('.pending')) {
    return 'pending'
  }
  return null
}

/** Prefer advancing status; always allow transition into `failed` and out of `failed`. */
export function shouldApplyRevelatorStatus(
  current: string | null | undefined,
  next: RevelatorStatus,
): boolean {
  if (!current || !(REVELATOR_STATUSES as readonly string[]).includes(current)) {
    return true
  }
  if (current === next) return true
  if (next === 'failed' || current === 'failed') return true
  return STATUS_RANK[next] >= STATUS_RANK[current as RevelatorStatus]
}

/**
 * Webhook body for POST /api/webhooks/export/revelator.
 * Identity: Tahti release id (`externalId` from submit, or `releaseId`) and/or
 * `revelatorId`. Status: `status` and/or `event` (mapped via mapRevelatorWebhookStatus).
 */
export const RevelatorExportWebhookBodySchema = z
  .object({
    externalId: z.string().min(1).optional(),
    releaseId: z.string().min(1).optional(),
    revelatorId: z.string().min(1).optional(),
    status: z.string().optional(),
    event: z.string().optional(),
  })
  .refine((body) => Boolean(body.externalId || body.releaseId || body.revelatorId), {
    message: 'Provide externalId, releaseId, or revelatorId',
  })
  .refine((body) => Boolean(body.status || body.event), {
    message: 'Provide status or event',
  })

export type RevelatorExportWebhookBody = z.infer<typeof RevelatorExportWebhookBodySchema>

export const RevelatorReleaseStatusSchema = z.object({
  revelatorId: z.string().nullable(),
  revelatorStatus: z.string().nullable(),
  title: z.string(),
})

export const RevelatorSubmitAcceptedSchema = z.object({
  releaseId: z.string(),
  revelatorStatus: z.literal('pending'),
})

export const RevelatorBillingStatusSchema = z.object({
  paid: z.boolean(),
  feeCents: z.number().int(),
  waived: z.boolean(),
  studioIncludedRemaining: z.number().int().nullable(),
  distributionPaidAt: z.string().nullable(),
})

export const RevelatorCheckoutResponseSchema = z.union([
  z.object({
    checkoutUrl: z.string().url(),
    sessionId: z.string(),
  }),
  z.object({
    paid: z.literal(true),
    feeCents: z.number().int(),
    waived: z.boolean(),
  }),
])

export const RevelatorRoyaltyReportRowSchema = z.object({
  id: z.string(),
  releaseId: z.string(),
  releaseTitle: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  streams: z.number().int().nullable(),
  syncedAt: z.string(),
})

export const RevelatorRoyaltyReportsSchema = z.object({
  reports: z.array(RevelatorRoyaltyReportRowSchema),
})
