// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  RevelatorReleaseStatusSchema,
  RevelatorBillingStatusSchema,
  RevelatorCheckoutResponseSchema,
  RevelatorRoyaltyReportsSchema,
  RevelatorSubmitAcceptedSchema,
} from './revelator.js'

describe('Revelator DTOs', () => {
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
