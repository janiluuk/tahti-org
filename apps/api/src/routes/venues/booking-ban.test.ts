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

const PREFIX = 'venue-booking-ban-'

describe('A booking ban covers venue shows', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let venueId: string
  let cookie: string
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
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const venue = await prisma.venue.create({
      data: { slug, name: 'Club', address: '1 Test St', city: 'Helsinki', createdBy: userId },
    })
    venueId = venue.id
    await prisma.accountRestriction.create({
      data: { userId, type: 'LIVE_SHOW_BOOKING', reason: 'No-shows' },
    })
  })

  afterAll(async () => {
    await prisma.accountRestriction.deleteMany({ where: { userId } })
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('refuses to add a show while the ban is active', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/venues/${slug}/broadcasts`,
      headers: { cookie },
      payload: { startAt: new Date(Date.now() + 86_400_000).toISOString() },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Booking is blocked: No-shows')
    expect(await prisma.venueBroadcast.count({ where: { venueId } })).toBe(0)
  })

  it('accepts the show once the ban is lifted', async () => {
    await prisma.accountRestriction.updateMany({
      where: { userId },
      data: { liftedAt: new Date() },
    })
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/venues/${slug}/broadcasts`,
      headers: { cookie },
      payload: { startAt: new Date(Date.now() + 86_400_000).toISOString() },
    })
    expect(res.statusCode).toBe(201)
  })
})
