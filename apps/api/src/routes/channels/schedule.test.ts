// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'
import type { PublicChannelSchedule } from '@tahti/shared'

const PREFIX = 'public-channel-schedule-test-'
const HOUR = 3_600_000

describe('GET /api/channels/:slug/schedule', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let slug: string
  let suspendedSlug: string

  async function scheduleFixtures(channelId: string) {
    const publicSeries = await prisma.liveShowSeries.create({
      data: {
        channelId,
        name: 'Friday Night Set',
        scheduleNote: 'Fridays 22:00 EET',
        intervalHours: 2,
      },
    })
    const fanSeries = await prisma.liveShowSeries.create({
      data: { channelId, name: 'Fan Hangout', visibility: 'FAN_ONLY' },
    })
    const base = {
      channelId,
      showType: 'LIVE_SET' as const,
      autoPublish: true,
    }
    await prisma.scheduledLiveShow.createMany({
      data: [
        {
          ...base,
          seriesId: publicSeries.id,
          title: 'Upcoming public',
          visibility: 'PUBLIC',
          startAt: new Date(Date.now() + 48 * HOUR),
          endAt: new Date(Date.now() + 49.5 * HOUR),
          episodeNumber: 4,
        },
        {
          ...base,
          seriesId: publicSeries.id,
          title: 'Sooner public, no end',
          visibility: 'PUBLIC',
          startAt: new Date(Date.now() + 24 * HOUR),
        },
        {
          ...base,
          seriesId: publicSeries.id,
          title: 'Past public',
          visibility: 'PUBLIC',
          startAt: new Date(Date.now() - 24 * HOUR),
        },
        {
          ...base,
          seriesId: publicSeries.id,
          title: 'Canceled public',
          visibility: 'PUBLIC',
          startAt: new Date(Date.now() + 72 * HOUR),
          canceledAt: new Date(),
        },
        {
          ...base,
          seriesId: publicSeries.id,
          title: 'Fan-only show',
          visibility: 'FAN_ONLY',
          startAt: new Date(Date.now() + 30 * HOUR),
        },
        {
          ...base,
          seriesId: fanSeries.id,
          title: 'Public show in a fan-only series',
          visibility: 'PUBLIC',
          startAt: new Date(Date.now() + 36 * HOUR),
        },
        {
          ...base,
          seriesId: publicSeries.id,
          title: 'Too far out',
          visibility: 'PUBLIC',
          startAt: new Date(Date.now() + 90 * 24 * HOUR),
        },
      ],
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
    })
    slug = artist.channel!.slug
    await scheduleFixtures(artist.channel!.id)

    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}suspended@example.com`,
      username: `${PREFIX}suspended`,
      tier: 'ARTIST',
    })
    suspendedSlug = suspended.channel!.slug
    await scheduleFixtures(suspended.channel!.id)
    await prisma.user.update({
      where: { id: suspended.id },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns only upcoming public shows in start order, with their series', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/channels/${slug}/schedule` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as PublicChannelSchedule

    expect(body.shows.map((s) => s.title)).toEqual(['Sooner public, no end', 'Upcoming public'])
    expect(body.shows[0]).toMatchObject({ endAt: null, durationMin: 120, episodeNumber: null })
    expect(body.shows[1]).toMatchObject({ durationMin: 90, episodeNumber: 4 })
    expect(body.series).toEqual([
      { id: body.shows[0]!.seriesId, name: 'Friday Night Set', scheduleNote: 'Fridays 22:00 EET' },
    ])
  })

  it('returns 404 for a suspended owner', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/channels/${suspendedSlug}/schedule` })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for an unknown channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${PREFIX}missing/schedule`,
    })
    expect(res.statusCode).toBe(404)
  })
})
