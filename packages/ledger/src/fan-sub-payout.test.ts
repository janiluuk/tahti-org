// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'
import { processFanSubPayouts } from './fan-sub-payout.js'

describe('processFanSubPayouts transfer retry', () => {
  it('retries FAILED payouts with a transfer function', async () => {
    const transfer = vi.fn().mockResolvedValue('tr_test_123')
    const updates: Array<{ id: string; data: Record<string, unknown> }> = []

    const prisma = {
      fanSubPayout: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: 'pay_failed',
              artistUserId: 'artist_1',
              netToArtistCents: 465,
              stripeTransferId: null,
              createdAt: new Date(Date.now() - 48 * 3600 * 1000),
            },
          ]),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: object }) => {
          updates.push({ id: where.id, data: data as Record<string, unknown> })
        }),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          stripeConnectAccountId: 'acct_1',
          stripeConnectChargesEnabled: true,
        }),
      },
    }

    const summary = await processFanSubPayouts(prisma as never, { transfer })
    expect(transfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 465,
        destinationAccountId: 'acct_1',
        idempotencyKey: 'fansub-payout-pay_failed',
      }),
    )
    expect(summary.transferRetried).toBe(1)
    expect(updates.some((u) => u.id === 'pay_failed' && u.data.state === 'PAID')).toBe(true)
  })
})
