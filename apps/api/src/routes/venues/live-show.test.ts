// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  cleanupVenuesBySlugPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'venue-live-'

describe('a show on now stays listed', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let liveId: string
  let endedId: string
  const slug = `${PREFIX}club`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const venue = await prisma.venue.create({
      data: {
        slug,
        name: 'Live Club',
        address: '1 Test St',
        city: 'Helsinki',
        verifiedAt: new Date(),
        createdBy: artist.id,
      },
    })
    const hourAgo = new Date(Date.now() - 3600 * 1000)
    liveId = (
      await prisma.venueBroadcast.create({
        data: {
          venueId: venue.id,
          artistUserId: artist.id,
          startAt: hourAgo,
          state: 'LIVE',
          description: 'On now',
        },
      })
    ).id
    endedId = (
      await prisma.venueBroadcast.create({
        data: {
          venueId: venue.id,
          artistUserId: artist.id,
          startAt: hourAgo,
          state: 'COMPLETED',
        },
      })
    ).id
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the live show on the venue profile, not the finished one', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/venues/${slug}` })
    expect(res.statusCode).toBe(200)
    const ids = (res.json().broadcasts as Array<{ id: string }>).map((b) => b.id)
    expect(ids).toContain(liveId)
    expect(ids).not.toContain(endedId)
  })

  it('keeps the live show in the calendar feed', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/venues/${slug}/calendar.ics` })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(`UID:${liveId}@tahti.live`)
    expect(res.body).not.toContain(`UID:${endedId}@tahti.live`)
  })

  it("keeps the live show in the owner's venue list", async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/venues', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const venue = (res.json() as Array<{ slug: string; broadcasts: Array<{ id: string }> }>).find(
      (v) => v.slug === slug,
    )
    expect(venue?.broadcasts.map((b) => b.id)).toContain(liveId)
  })
})
