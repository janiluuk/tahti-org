// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildGrantPreview } from './grant-preview.js'

describe('buildGrantPreview', () => {
  it('flags high unit share and dominant IP', async () => {
    const channelId = 'ch-1'
    const userId = 'user-1'
    const prisma = {
      grantDisbursement: { count: async () => 0 },
      monthlyRollup: {
        findMany: async () => [{ surplus: BigInt(100_000) }],
      },
      download: {
        groupBy: async () => [
          { channelId, weight: 1, _count: 90 },
          { channelId: 'ch-2', weight: 1, _count: 10 },
        ],
        findMany: async ({ where }: { where: { channelId: string } }) => {
          if (where.channelId === 'ch-2') {
            return Array.from({ length: 5 }, () => ({ byIpHash: 'ip-b' }))
          }
          return Array.from({ length: 20 }, (_, i) => ({
            byIpHash: i < 18 ? 'same-ip' : `ip-${i}`,
          }))
        },
      },
      channel: {
        findMany: async () => [
          { id: channelId, userId },
          { id: 'ch-2', userId: 'user-2' },
        ],
      },
      fanSubPayout: { groupBy: async () => [] },
      user: {
        findMany: async () => [
          {
            id: userId,
            username: 'big-artist',
            displayName: 'Big',
            publicAttribution: true,
            channel: { id: channelId },
          },
          {
            id: 'user-2',
            username: 'small',
            displayName: 'Small',
            publicAttribution: false,
            channel: { id: 'ch-2' },
          },
        ],
      },
    } as unknown as Parameters<typeof buildGrantPreview>[0]

    const preview = await buildGrantPreview(prisma, 2032)
    const big = preview.artists.find((a) => a.userId === userId)
    expect(big?.anomalies.some((a) => a.code === 'DOMINANT_IP')).toBe(true)
    expect(big?.anomalies.some((a) => a.code === 'HIGH_UNIT_SHARE')).toBe(true)

    const small = preview.artists.find((a) => a.userId === 'user-2')
    expect(small?.anomalies.some((a) => a.code === 'ANONYMOUS_GRANT')).toBe(true)
  })
})
