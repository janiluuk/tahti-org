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

const PREFIX = 'venue-show-booked-'

describe('A venue owner is told about new shows at the venue', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerId: string
  let ownerCookie: string
  let artistCookie: string
  const slug = `${PREFIX}club`
  const startAt = '2026-12-04T19:00:00.000Z'

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
      tier: 'ARTIST',
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)
    await prisma.venue.create({
      data: { slug, name: 'Kellari', address: '1 Test St', city: 'Helsinki', createdBy: ownerId },
    })
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const book = (cookie: string) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/venues/${slug}/broadcasts`,
      headers: { cookie },
      payload: { startAt },
    })

  const notices = () =>
    prisma.notification.findMany({ where: { userId: ownerId, type: 'VENUE_SHOW_BOOKED' } })

  it('notifies the owner when an artist books', async () => {
    expect((await book(artistCookie)).statusCode).toBe(201)
    const [notice] = await notices()
    expect(notice).toMatchObject({
      title: 'DJ Kaski added a show at Kellari',
      body: 'On 2026-12-04',
      url: '/venues/mine',
    })
  })

  it('stays quiet when the owner books their own venue', async () => {
    expect((await book(ownerCookie)).statusCode).toBe(201)
    expect(await notices()).toHaveLength(1)
  })
})
