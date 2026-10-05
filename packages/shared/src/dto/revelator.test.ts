// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  RevelatorReleaseStatusSchema,
  RevelatorBillingStatusSchema,
  RevelatorCheckoutResponseSchema,
  RevelatorRoyaltyReportsSchema,
  RevelatorSubmitAcceptedSchema,
  mapRevelatorWebhookStatus,
  shouldApplyRevelatorStatus,
  RevelatorExportWebhookBodySchema,
} from './revelator.js'

describe('Revelator DTOs', () => {
  it('maps webhook status/event strings', () => {
    expect(mapRevelatorWebhookStatus('delivered')).toBe('delivered')
    expect(mapRevelatorWebhookStatus(undefined, 'delivery.completed')).toBe('delivered')
    expect(mapRevelatorWebhookStatus('processing')).toBe('submitted')
    expect(mapRevelatorWebhookStatus('failed')).toBe('failed')
    expect(mapRevelatorWebhookStatus('mystery')).toBeNull()
  })

  it('does not regress delivered → submitted', () => {
    expect(shouldApplyRevelatorStatus('delivered', 'submitted')).toBe(false)
    expect(shouldApplyRevelatorStatus('submitted', 'delivered')).toBe(true)
    expect(shouldApplyRevelatorStatus('delivered', 'failed')).toBe(true)
    expect(shouldApplyRevelatorStatus('failed', 'submitted')).toBe(true)
  })

  it('parses export webhook body', () => {
    expect(
      RevelatorExportWebhookBodySchema.safeParse({
        releaseId: 'rel_1',
        event: 'delivery.completed',
      }).success,
    ).toBe(true)
    expect(RevelatorExportWebhookBodySchema.safeParse({ event: 'status' }).success).toBe(false)
  })

  it('parses release status', () => {
    const parsed = RevelatorReleaseStatusSchema.safeParse({
      revelatorId: 'rev-1',
      revelatorStatus: 'submitted',
      title: 'EP',
    })
    expect(parsed.success).toBe(true)
  })

  it('parses submit accepted response', () => {
    const parsed = RevelatorSubmitAcceptedSchema.safeParse({
      releaseId: 'rel_1',
      revelatorStatus: 'pending',
    })
    expect(parsed.success).toBe(true)
  })

  it('parses billing and checkout responses', () => {
    expect(
      RevelatorBillingStatusSchema.safeParse({
        paid: false,
        feeCents: 800,
        waived: false,
        studioIncludedRemaining: null,
        distributionPaidAt: null,
      }).success,
    ).toBe(true)
    expect(
      RevelatorCheckoutResponseSchema.safeParse({
        paid: true,
        feeCents: 0,
        waived: true,
      }).success,
    ).toBe(true)
  })

  it('parses royalty report list', () => {
    const parsed = RevelatorRoyaltyReportsSchema.safeParse({
      reports: [
        {
          id: 'rr_1',
          releaseId: 'rel_1',
          releaseTitle: 'Single',
          periodStart: '2026-05-01',
          periodEnd: '2026-05-31',
          amountCents: 1250,
          currency: 'EUR',
          streams: 100,
          syncedAt: '2026-06-05T00:00:00.000Z',
        },
      ],
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects invalid royalty amount type', () => {
    const parsed = RevelatorRoyaltyReportsSchema.safeParse({
      reports: [{ amountCents: '12.50' }],
    })
    expect(parsed.success).toBe(false)
  })
})
