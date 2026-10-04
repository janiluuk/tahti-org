// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'next-broadcast-show-'

describe('next broadcast linked to a show', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let seriesId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'next-broadcast-show',
      tier: 'ARTIST',
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'next-broadcast-other',
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    otherCookie = await sessionCookieFor(prisma, other.id)
    const series = await app.inject({
      method: 'POST',
      url: '/api/me/channel/show-series',
      headers: { cookie },
      payload: {
        name: 'Northern lights session',
        description: 'Two hours of slow techno.',
        artworkUrl: 'https://cdn.example.com/northern.jpg',
        showType: 'TALK',
        mode: 'SINGLE',
      },
    })
    seriesId = series.json().id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const patch = (payload: Record<string, unknown>, as = cookie) =>
    app.inject({
      method: 'PATCH',
      url: '/api/me/channel/schedule',
      headers: { cookie: as },
      payload,
    })

  it('stores the show and length and reads the rest from the show', async () => {
    const nextBroadcastAt = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const res = await patch({
      nextBroadcastAt,
      nextBroadcastNote: 'Northern lights session',
      nextBroadcastShowId: seriesId,
      nextBroadcastDurationHours: 2,
    })
    expect(res.statusCode).toBe(200)
    const expected = {
      nextBroadcastAt,
      nextBroadcastNote: 'Northern lights session',
      nextBroadcastShowId: seriesId,
      nextBroadcastDurationHours: 2,
      nextBroadcastShowType: 'TALK',
      nextBroadcastMode: 'SINGLE',
      nextBroadcastDescription: 'Two hours of slow techno.',
      nextBroadcastCoverUrl: 'https://cdn.example.com/northern.jpg',
    }
    expect(res.json()).toEqual(expected)

    const get = await app.inject({
      method: 'GET',
      url: '/api/me/channel/schedule',
      headers: { cookie },
    })
    expect(get.json()).toEqual(expected)
  })

  it("refuses another artist's show", async () => {
    const res = await patch({ nextBroadcastShowId: seriesId }, otherCookie)
    expect(res.statusCode).toBe(404)
  })

  it('unlinks the show', async () => {
    const res = await patch({ nextBroadcastShowId: null })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      nextBroadcastShowId: null,
      nextBroadcastShowType: null,
      nextBroadcastMode: null,
      nextBroadcastDescription: null,
      nextBroadcastCoverUrl: null,
    })
  })

  it('links the show a recurring series schedules next', async () => {
    const series = await app.inject({
      method: 'POST',
      url: '/api/me/channel/show-series',
      headers: { cookie },
      payload: {
        name: 'Daily drift',
        recurrenceEnabled: true,
        recurrenceDays: [0, 1, 2, 3, 4, 5, 6],
        recurrenceTimeOfDay: '21:00',
        recurrenceDurationMin: 120,
        recurrenceTimezone: 'Europe/Helsinki',
      },
    })
    expect(series.statusCode).toBe(201)
    const get = await app.inject({
      method: 'GET',
      url: '/api/me/channel/schedule',
      headers: { cookie },
    })
    expect(get.json()).toMatchObject({
      nextBroadcastShowId: series.json().id,
      nextBroadcastDurationHours: 2,
      nextBroadcastMode: 'SERIES',
    })
  })
})
