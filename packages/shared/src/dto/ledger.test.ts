// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { CreateLedgerEntrySchema, LedgerExportQuerySchema } from './ledger.js'

describe('ledger DTOs', () => {
  it('accepts a valid manual entry', () => {
    const parsed = CreateLedgerEntrySchema.safeParse({
      category: 'COST_INFRASTRUCTURE',
      amountCents: 1200,
      description: 'UpCloud invoice',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects fan-sub categories for manual entry', () => {
    const parsed = CreateLedgerEntrySchema.safeParse({
      category: 'FAN_SUB_GROSS_RECEIVED',
      amountCents: 500,
      description: 'x',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
    })
    expect(parsed.success).toBe(false)
  })

  it('parses export year', () => {
    expect(LedgerExportQuerySchema.safeParse({ year: '2026' }).success).toBe(true)
    expect(LedgerExportQuerySchema.safeParse({ year: 'bad' }).success).toBe(false)
  })
})
