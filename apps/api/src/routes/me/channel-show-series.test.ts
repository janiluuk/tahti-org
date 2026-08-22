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

const PREFIX = 'show-series-test-'

describe('Show series and episodes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'show-series-artist',
      tier: 'ARTIST',
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates, patches, and lists episodes under a series', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/me/channel/show-series',
      headers: { cookie },
      payload: { name: 'Midnight Cartography', intervalHours: 2, scheduleNote: 'Fridays 22:00' },
    })
    expect(create.statusCode).toBe(201)
    const series = create.json()
    expect(series.intervalHours).toBe(2)
    expect(series.scheduleNote).toBe('Fridays 22:00')
    expect(series.nextEpisodeNumber).toBe(1)

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/show-series/${series.id}`,
      headers: { cookie },
      payload: { scheduleNote: 'Saturdays 21:00' },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().scheduleNote).toBe('Saturdays 21:00')
    expect(patch.json().name).toBe('Midnight Cartography')

    const archiveItem = await createReadyArchiveItem(prisma, channelId, 'Episode 1 master')

    const uploadEpisode = await app.inject({
      method: 'POST',
      url: `/api/me/channel/show-series/${series.id}/live-show-episodes`,
      headers: { cookie },
      payload: { source: 'UPLOAD', archiveItemId: archiveItem.id },
    })
    expect(uploadEpisode.statusCode).toBe(201)
    const uploadBody = uploadEpisode.json()
    expect(uploadBody.status).toBe('DRAFT')
    expect(uploadBody.episodeNumber).toBe(1)
    expect(uploadBody.title).toBe('Midnight Cartography #1')
    expect(uploadBody.archiveItemId).toBe(archiveItem.id)

    const broadcastEpisode = await app.inject({
      method: 'POST',
      url: `/api/me/channel/show-series/${series.id}/live-show-episodes`,
      headers: { cookie },
      payload: { source: 'BROADCAST', title: 'Live cut' },
    })
    expect(broadcastEpisode.statusCode).toBe(201)
    const broadcastBody = broadcastEpisode.json()
    expect(broadcastBody.status).toBe('PENDING_APPROVAL')
    expect(broadcastBody.episodeNumber).toBe(2)
    expect(broadcastBody.title).toBe('Live cut')

    const list = await app.inject({
      method: 'GET',
      url: `/api/me/channel/show-series/${series.id}/live-show-episodes`,
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    const episodes = list.json().episodes
    expect(episodes).toHaveLength(2)
    expect(episodes[0].episodeNumber).toBe(2)

    const getOne = await app.inject({
      method: 'GET',
      url: `/api/me/channel/live-show-episodes/${uploadBody.id}`,
      headers: { cookie },
    })
    expect(getOne.statusCode).toBe(200)
    expect(getOne.json().id).toBe(uploadBody.id)

    const approve = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/live-show-episodes/${broadcastBody.id}`,
      headers: { cookie },
      payload: { status: 'APPROVED' },
    })
    expect(approve.statusCode).toBe(200)
    expect(approve.json().status).toBe('APPROVED')

    const seriesAfter = await app.inject({
      method: 'GET',
      url: '/api/me/channel/show-series',
      headers: { cookie },
    })
    expect(
      seriesAfter.json().series.find((s: { id: string }) => s.id === series.id).nextEpisodeNumber,
    ).toBe(3)
  })

  it("rejects an episode create with someone else's archive item", async () => {
    const otherArtist = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'show-series-other',
      tier: 'ARTIST',
    })
    const otherItem = await createReadyArchiveItem(prisma, otherArtist.channel!.id, 'Not mine')

    const series = await app.inject({
      method: 'POST',
      url: '/api/me/channel/show-series',
      headers: { cookie },
      payload: { name: 'Cross-channel test' },
    })
    const seriesId = series.json().id

    const attempt = await app.inject({
      method: 'POST',
      url: `/api/me/channel/show-series/${seriesId}/live-show-episodes`,
      headers: { cookie },
      payload: { source: 'UPLOAD', archiveItemId: otherItem.id },
    })
    expect(attempt.statusCode).toBe(400)
    expect(attempt.json().error).toMatch(/archive item/i)
  })

  it('404s for a series that does not belong to the caller', async () => {
    const attempt = await app.inject({
      method: 'GET',
      url: '/api/me/channel/show-series/not-a-real-id/live-show-episodes',
      headers: { cookie },
    })
    expect(attempt.statusCode).toBe(404)
  })
})
