// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'
import type { PrismaClient } from '@tahti/db'
import { processMembershipLapse } from './membership-lifecycle.js'

describe('processMembershipLapse', () => {
  it('tells each lapsed member their membership ended', async () => {
    const create = vi.fn((args: unknown) => ({ op: 'notification', args }))
    const prisma = {
      user: { findMany: vi.fn().mockResolvedValue([{ id: 'u1' }]), update: vi.fn(() => ({})) },
      membership: { updateMany: vi.fn(() => ({})) },
      auditLog: { create: vi.fn(() => ({})) },
      notification: { create },
      $transaction: vi.fn().mockResolvedValue([]),
    } as unknown as PrismaClient

    expect(await processMembershipLapse(prisma)).toEqual({ lapsed: 1 })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        type: 'MEMBERSHIP_ENDED',
        title: 'Your Tahti membership has ended',
        url: '/settings/account',
      }),
    })
  })
})
