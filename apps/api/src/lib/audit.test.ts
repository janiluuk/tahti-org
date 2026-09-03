// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { auditLog, auditUserTierChange } from './audit.js'
import { prisma } from '@tahti/db'

describe('auditLog', () => {
  it('accepts STRIPE_WEBHOOK_ERROR without throwing', async () => {
    await expect(
      auditLog(prisma, {
        action: 'STRIPE_WEBHOOK_ERROR',
        actorId: 'system',
        targetId: 'evt_audit_test',
        meta: { eventType: 'invoice.paid', message: 'test' },
      }),
    ).resolves.toBeUndefined()

    const row = await prisma.auditLog.findFirst({
      where: { action: 'STRIPE_WEBHOOK_ERROR', targetId: 'evt_audit_test' },
    })
    expect(row?.meta).toMatchObject({ eventType: 'invoice.paid' })

    if (row) {
      await prisma.auditLog.delete({ where: { id: row.id } })
    }
  })

  it('skips USER_TIER_CHANGE when the tier is unchanged', async () => {
    await auditUserTierChange(prisma, {
      actorId: 'system',
      targetId: 'tier-unchanged',
      from: 'ARTIST',
      to: 'ARTIST',
      reason: 'admin_patch',
    })
    const row = await prisma.auditLog.findFirst({
      where: { action: 'USER_TIER_CHANGE', targetId: 'tier-unchanged' },
    })
    expect(row).toBeNull()
  })
})
