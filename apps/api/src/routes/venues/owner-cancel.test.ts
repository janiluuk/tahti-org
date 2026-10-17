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

const PREFIX = 'venue-ocancel-'

describe('cancelling a show at a venue', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let strangerCookie: string
  let showId: string
  const slug = `${PREFIX}club`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
    })
    const stranger = await createTestArtist(prisma, {
      email: `${PREFIX}stranger@example.com`,
      username: `${PREFIX}stranger`,
    })
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    strangerCookie = await sessionCookieFor(prisma, stranger.id)
    const venue = await prisma.venue.create({
      data: {
        slug,
        name: 'Owner Club',
        address: '1 Test St',
        city: 'Helsinki',
        verifiedAt: new Date(),
        createdBy: owner.id,
      },
    })
    showId = (
      await prisma.venueBroadcast.create({
        data: {
          venueId: venue.id,
          artistUserId: artist.id,
          startAt: new Date(Date.now() + 86400 * 1000),
          state: 'SCHEDULED',
        },
      })
    ).id
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('refuses someone who neither booked the show nor runs the venue', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/venues/${slug}/broadcasts/${showId}`,
      headers: { cookie: strangerCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it("lets the venue's owner cancel a show an artist booked there", async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/venues/${slug}/broadcasts/${showId}`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(204)
    const show = await prisma.venueBroadcast.findUniqueOrThrow({ where: { id: showId } })
    expect(show.state).toBe('CANCELED')
  })
})
