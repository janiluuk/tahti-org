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
        groupBy: async (args: { by: string[] }) => {
          if (args.by.includes('byIpHash')) {
            // DOMINANT_IP check: ch-1 has 20 counted downloads, 18 from the same
            // IP hash (90% — over the 40% threshold); ch-2 has 5, below the
            // 15-download minimum to even consider it.
            return [
              { channelId, byIpHash: 'same-ip', _count: { _all: 18 } },
              { channelId, byIpHash: 'ip-18', _count: { _all: 1 } },
              { channelId, byIpHash: 'ip-19', _count: { _all: 1 } },
              { channelId: 'ch-2', byIpHash: 'ip-b', _count: { _all: 5 } },
            ]
          }
          return [
            { channelId, weight: 1, _count: 90 },
            { channelId: 'ch-2', weight: 1, _count: 10 },
          ]
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
