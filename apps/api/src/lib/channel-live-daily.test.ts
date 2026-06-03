// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildLiveDailySeries } from './channel-live-daily.js'

describe('buildLiveDailySeries', () => {
  it('returns empty series when channel has no broadcasts', async () => {
    const prisma = {
      broadcast: {
        findMany: async () => [],
      },
    } as never

    const series = await buildLiveDailySeries(prisma, 'ch1', 3)
    expect(series).toHaveLength(3)
    expect(series.every((d) => d.liveSeconds === 0 && d.broadcastCount === 0)).toBe(true)
  })
})
