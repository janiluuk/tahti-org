// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@tahti/db'

const { sendGovernanceMeetingNoticeEmail } = vi.hoisted(() => ({
  sendGovernanceMeetingNoticeEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('./email.js', () => ({ sendGovernanceMeetingNoticeEmail }))

import { sendMeetingNoticeAndRecordDeliveries } from './governance-notice.js'

describe('sendMeetingNoticeAndRecordDeliveries', () => {
  it('greets a member by username when their display name is an email address', async () => {
    const prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'member-1',
            email: 'member@example.com',
            username: 'member',
            displayName: 'member@example.com',
          },
        ]),
      },
      governanceNoticeDelivery: { upsert: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaClient

    await sendMeetingNoticeAndRecordDeliveries(prisma, {
      id: 'meeting-1',
      title: 'Autumn meeting',
      type: 'REGULAR',
      scheduledAt: null,
      location: null,
      remoteUrl: null,
    })

    expect(sendGovernanceMeetingNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'member@example.com', displayName: 'member' }),
    )
  })
})
