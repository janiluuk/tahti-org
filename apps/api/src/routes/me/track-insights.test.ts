// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'track-insights-'

describe('M37 — per-track insights', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let archiveItemId: string
  let releaseTrackId: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'track-insights-artist',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelId = artist.channel!.id

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'track-insights-other',
    })
    otherCookie = await sessionCookieFor(prisma, other.id)

    const item = await createReadyArchiveItem(prisma, channelId, 'Insights Test Track')
    archiveItemId = item.id

    const release = await prisma.release.create({
      data: {
        userId: artist.id,
        title: 'Insights EP',
        type: 'EP',
        state: 'PUBLISHED',
        releaseDate: new Date(),
        smartLinkSlug: `${PREFIX}ep`,
      },
    })
    const track = await prisma.releaseTrack.create({
      data: { releaseId: release.id, position: 1, title: 'Insights Track' },
    })
    releaseTrackId = track.id

    await prisma.download.createMany({
      data: [
        {
          channelId,
          archiveItemId,
          format: 'mp3',
          byFingerprint: 'ti-fp-1',
          byIpHash: 'ti-ip-1',
          countedAt: new Date(),
          countryCode: 'FI',
          weight: 1,
        },
        {
          channelId,
          archiveItemId,
          format: 'mp3',
          byFingerprint: 'ti-fp-2',
          byIpHash: 'ti-ip-2',
          countedAt: new Date(),
          countryCode: 'SE',
          weight: 1,
        },
        {
          channelId,
          releaseTrackId,
          format: 'mp3',
          byFingerprint: 'ti-fp-3',
          byIpHash: 'ti-ip-3',
          countedAt: new Date(),
          countryCode: 'FI',
          weight: 1,
        },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/me/archive/:id/insights returns totals + country breakdown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/insights`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      title: string
      totalDownloads: number
      totalPlays: number
      countries: Array<{ countryCode: string; count: number }>
    }
    expect(body.title).toBe('Insights Test Track')
    expect(body.totalDownloads).toBe(2)
    expect(body.totalPlays).toBe(2)
    expect(body.countries.map((c) => c.countryCode).sort()).toEqual(['FI', 'SE'])
  })

  it('GET /api/me/release-tracks/:id/insights returns totals + country breakdown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/release-tracks/${releaseTrackId}/insights`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      title: string
      totalDownloads: number
      countries: Array<{ countryCode: string; count: number }>
    }
    expect(body.title).toBe('Insights Track')
    expect(body.totalDownloads).toBe(1)
    expect(body.countries).toEqual([{ countryCode: 'FI', displayName: 'Finland', count: 1 }])
  })

  it('rejects a track owned by someone else', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/insights`,
      headers: { cookie: otherCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/insights`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('404s for an unknown track id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/archive/nonexistent-id/insights',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(404)
  })
})
