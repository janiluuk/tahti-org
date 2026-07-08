// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  ChannelFunnelResponseSchema,
  ChannelLiveStatsResponseSchema,
  ChatAccessResponseSchema,
  CsvExportBodySchema,
  DownloadGateItemDetailResponseSchema,
  DownloadGateStatsResponseSchema,
  DownloadGateStatusSchema,
  DownloadUrlResponseSchema,
  FallbackM3uBodySchema,
  PlainTextErrorSchema,
  PrometheusMetricsBodySchema,
  PublicProfileViewSchema,
  SmartLinkViewSchema,
} from './api-responses.js'
import { zodOpenApiComponents } from '../openapi-zod.js'

describe('api response schemas', () => {
  it('parses channel funnel shape', () => {
    const parsed = ChannelFunnelResponseSchema.safeParse({
      downloadGates: {
        artistFollowerCount: 0,
        items: [],
        totals: { repostAcks: 0, blockedAttempts: 0, countedDownloads: 0 },
        daily: [],
      },
      live: {
        windowDays: 14,
        totalLiveSeconds: 0,
        totalBroadcasts: 0,
        peakDailyListeners: 0,
        daily: [],
      },
    })
    expect(parsed.success).toBe(true)
  })

  it('parses channel live stats shape', () => {
    const parsed = ChannelLiveStatsResponseSchema.safeParse({
      windowDays: 14,
      totalLiveSeconds: 3600,
      totalBroadcasts: 2,
      peakDailyListeners: 12,
      daily: [{ date: '2026-06-01', liveSeconds: 1800, broadcastCount: 1, listeners: 12 }],
    })
    expect(parsed.success).toBe(true)
  })

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

  it('parses public profile view', () => {
    const parsed = PublicProfileViewSchema.safeParse({
      artist: {
        username: 'dj1',
        displayName: 'DJ',
        bio: null,
        avatarUrl: null,
        socialLinks: {},
        tipJarUrl: null,
        tier: 'ARTIST',
      },
      channel: { slug: 'dj1', state: 'OFFLINE' },
      releases: [],
      fanTiers: [],
      collections: [],
      links: {
        channel: '/c/dj1',
        subscribe: '/u/dj1/subscribe',
        feeds: { archive: 'https://api.example/u/dj1/rss.xml' },
      },
    })
    expect(parsed.success).toBe(true)
  })

  it('parses smart link view', () => {
    const parsed = SmartLinkViewSchema.safeParse({
      release: { id: 'r1', title: 'EP' },
      artist: { username: 'dj1', displayName: 'DJ', avatarUrl: null },
      featuredCollections: [],
      profileUrl: 'https://tahti.live/u/dj1',
      releaseUrl: 'https://tahti.live/u/dj1#r1',
      targets: {},
      embedUrl: 'https://tahti.live/embed/r/r1',
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

  it('parses PLAT-014 plain-text and CSV response bodies', () => {
    expect(PrometheusMetricsBodySchema.safeParse('# HELP x\nx 1').success).toBe(true)
    expect(CsvExportBodySchema.safeParse('id,name\n1,test').success).toBe(true)
    expect(FallbackM3uBodySchema.safeParse('#EXTM3U\n').success).toBe(true)
    expect(PlainTextErrorSchema.safeParse('unauthorized').success).toBe(true)
  })

  it('parses chat access response', () => {
    expect(
      ChatAccessResponseSchema.safeParse({
        fanChatEnabled: true,
        isSupporter: false,
        canJoinFanChat: false,
      }).success,
    ).toBe(true)
  })
})
