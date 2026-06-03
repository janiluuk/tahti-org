// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  DownloadGateItemDetailResponseSchema,
  DownloadGateStatsResponseSchema,
  DownloadGateStatusSchema,
  DownloadUrlResponseSchema,
} from './api-responses.js'
import { zodOpenApiComponents } from '../openapi-zod.js'

describe('api response schemas', () => {
  it('parses download gate stats shape', () => {
    const parsed = DownloadGateStatsResponseSchema.safeParse({
      artistFollowerCount: 2,
      items: [],
      totals: { repostAcks: 1, blockedAttempts: 0, countedDownloads: 3 },
      daily: [{ date: '2026-06-01', repostAcks: 1, blockedAttempts: 0, countedDownloads: 3 }],
    })
    expect(parsed.success).toBe(true)
  })

  it('parses download gate status', () => {
    const parsed = DownloadGateStatusSchema.safeParse({
      repostRequired: true,
      followRequired: false,
      repostSatisfied: false,
      followSatisfied: true,
      canDownload: false,
    })
    expect(parsed.success).toBe(true)
  })

  it('parses download URL response', () => {
    const parsed = DownloadUrlResponseSchema.safeParse({
      url: 'https://minio.example/presigned',
      counted: true,
    })
    expect(parsed.success).toBe(true)
  })

  it('parses per-item download gate detail', () => {
    const parsed = DownloadGateItemDetailResponseSchema.safeParse({
      repostToDownload: true,
      followToDownload: false,
      artistFollowerCount: 1,
      repostAckCount: 2,
      blockedDownloadAttempts: 0,
      countedDownloadCount: 4,
    })
    expect(parsed.success).toBe(true)
  })

  it('exports OpenAPI component schema', () => {
    const components = zodOpenApiComponents({
      DownloadGateStats: DownloadGateStatsResponseSchema,
    })
    expect(components.DownloadGateStats).toBeTruthy()
    expect(JSON.stringify(components.DownloadGateStats)).toContain('artistFollowerCount')
  })
})
