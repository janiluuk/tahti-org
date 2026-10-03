// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@tahti/db'
import { assembleFeatureRequestQuarterlyReportMarkdown } from './feature-request-report.js'

describe('assembleFeatureRequestQuarterlyReportMarkdown', () => {
  it('names a proposer by username when their display name is an email address', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          title: 'Dark mode',
          status: 'PLANNED',
          reviewNote: null,
          _count: { votes: 3 },
          proposedBy: { username: 'proposer', displayName: 'proposer@example.com' },
        },
      ])
      .mockResolvedValue([])
    const prisma = { featureRequest: { findMany } } as unknown as PrismaClient

    const { markdown } = await assembleFeatureRequestQuarterlyReportMarkdown(prisma, 2026, 3)

    expect(markdown).toContain('proposed by proposer')
    expect(markdown).not.toContain('proposer@example.com')
  })
})
