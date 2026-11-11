// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  cleanupVenuesBySlugPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'events-tz-venue-'

describe('event timezone, venue and visibility', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistId: string
  let artistUsername: string
  let cookie: string
  let fanCookie: string
  let strangerCookie: string
  let verifiedVenueId: string
  let foreignVenueId: string

  const startAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString()

  const create = (payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: { title: 'Club night', place: 'Kaiku', location: 'Helsinki', startAt, ...payload },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    const stranger = await createTestArtist(prisma, {
      email: `${PREFIX}stranger@example.com`,
      username: `${PREFIX}stranger`,
    })
    artistId = artist.id
    artistUsername = artist.username
    cookie = await sessionCookieFor(prisma, artist.id)
    fanCookie = await sessionCookieFor(prisma, fan.id)
    strangerCookie = await sessionCookieFor(prisma, stranger.id)
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `${PREFIX}sub`,
        state: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
      },
    })
    const verified = await prisma.venue.create({
      data: {
        slug: `${PREFIX}kaiku`,
        name: 'Kaiku',
        address: 'Kaikukatu 4',
        city: 'Helsinki',
        createdBy: stranger.id,
        verifiedAt: new Date(),
      },
    })
    const foreign = await prisma.venue.create({
      data: {
        slug: `${PREFIX}unverified`,
        name: 'Somebody else',
        address: '1 Test St',
        city: 'Tampere',
        createdBy: stranger.id,
      },
    })
    verifiedVenueId = verified.id
    foreignVenueId = foreign.id
  })

  afterAll(async () => {
    await prisma.artistEvent.deleteMany({ where: { userId: artistId } })
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('stores timezone, a verified venue and visibility and returns them', async () => {
    const res = await create({
      timezone: 'Europe/Helsinki',
      venueId: verifiedVenueId,
      visibility: 'PUBLIC',
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.timezone).toBe('Europe/Helsinki')
    expect(body.visibility).toBe('PUBLIC')
    expect(body.venue).toEqual({
      id: verifiedVenueId,
      slug: `${PREFIX}kaiku`,
      name: 'Kaiku',
      city: 'Helsinki',
    })
  })

  it('defaults to PUBLIC with no timezone or venue', async () => {
    const res = await create({})
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ timezone: null, venue: null, visibility: 'PUBLIC' })
  })

  it('rejects an unknown time zone and a venue the artist may not pick', async () => {
    const tz = await create({ timezone: 'Mars/Olympus' })
    expect(tz.statusCode).toBe(400)
    const venue = await create({ venueId: foreignVenueId })
    expect(venue.statusCode).toBe(400)
    expect(venue.json().code).toBe('unknown_venue')
  })

  it('clears timezone and venue on PATCH with null', async () => {
    const created = await create({ timezone: 'Europe/Helsinki', venueId: verifiedVenueId })
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/events/${created.json().id}`,
      headers: { cookie },
      payload: { timezone: null, venueId: null, visibility: 'FANS' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ timezone: null, venue: null, visibility: 'FANS' })
  })

  it('shows a FANS event to fan subscribers and the host only', async () => {
    const created = await create({ title: 'Fans only rehearsal', visibility: 'FANS' })
    expect(created.statusCode).toBe(201)
    const id = created.json().id as string
    const from = new Date().toISOString()
    const to = new Date(Date.now() + 30 * 86400_000).toISOString()
    const calendar = `/api/v1/events?from=${from}&to=${to}&artist=${artistUsername}`
    const titles = async (headers: Record<string, string>) =>
      (
        (await app.inject({ method: 'GET', url: calendar, headers })).json() as Array<{
          title: string
        }>
      ).map((e) => e.title)

    expect(await titles({})).not.toContain('Fans only rehearsal')
    expect(await titles({ cookie: strangerCookie })).not.toContain('Fans only rehearsal')
    expect(await titles({ cookie: fanCookie })).toContain('Fans only rehearsal')
    expect(await titles({ cookie })).toContain('Fans only rehearsal')

    const anon = await app.inject({ method: 'GET', url: `/api/v1/events/${id}` })
    expect(anon.statusCode).toBe(404)
    const fan = await app.inject({
      method: 'GET',
      url: `/api/v1/events/${id}`,
      headers: { cookie: fanCookie },
    })
    expect(fan.statusCode).toBe(200)
    expect(fan.json().visibility).toBe('FANS')

    const ics = await app.inject({ method: 'GET', url: `/api/v1/u/${artistUsername}/events.ics` })
    expect(ics.body).not.toContain('Fans only rehearsal')
  })
})
