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

const PREFIX = 'venue-show-canceled-'

describe('Cancelling a venue show tells the other side', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerId: string
  let artistId: string
  let venueId: string
  let ownerCookie: string
  let artistCookie: string
  const slug = `${PREFIX}club`
  const startAt = new Date('2026-12-04T19:00:00.000Z')

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
    })
    ownerId = owner.id
    ownerCookie = await sessionCookieFor(prisma, owner.id)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'DJ Kaski',
    })
    artistId = artist.id
    artistCookie = await sessionCookieFor(prisma, artist.id)
    const venue = await prisma.venue.create({
      data: { slug, name: 'Kellari', address: '1 Test St', city: 'Helsinki', createdBy: ownerId },
    })
    venueId = venue.id
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const show = () =>
    prisma.venueBroadcast.create({
      data: { venueId, artistUserId: artistId, startAt, state: 'SCHEDULED' },
    })

  const cancel = (id: string, cookie: string) =>
    app.inject({
      method: 'DELETE',
      url: `/api/v1/venues/${slug}/broadcasts/${id}`,
      headers: { cookie },
    })

  const notices = (userId: string) =>
    prisma.notification.findMany({ where: { userId, type: 'VENUE_SHOW_CANCELED' } })

  it('tells the artist when the venue cancels, once', async () => {
    const { id } = await show()
    expect((await cancel(id, ownerCookie)).statusCode).toBe(204)
    expect((await cancel(id, ownerCookie)).statusCode).toBe(204)
    const sent = await notices(artistId)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      title: 'Kellari cancelled your show',
      body: 'It was on 2026-12-04',
      url: '/studio/venues',
    })
  })

  it('tells the venue owner when the artist cancels', async () => {
    const { id } = await show()
    expect((await cancel(id, artistCookie)).statusCode).toBe(204)
    const [notice] = await notices(ownerId)
    expect(notice).toMatchObject({
      title: 'DJ Kaski cancelled their show at Kellari',
      url: '/venues/mine',
    })
  })
})
