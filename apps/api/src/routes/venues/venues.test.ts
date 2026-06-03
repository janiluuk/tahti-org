// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  cleanupVenuesBySlugPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'venue-test-'
const VENUE_PREFIX = 'venue-test-'

describe('M17 — venue calendar', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let venueSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupVenuesBySlugPrefix(prisma, VENUE_PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'venue-test-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98370,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    venueSlug = `${VENUE_PREFIX}-club`
    await prisma.venue.create({
      data: {
        slug: venueSlug,
        name: 'Test Club',
        address: '1 Test St',
        city: 'Helsinki',
        countryCode: 'FI',
        verifiedAt: new Date(),
        createdBy: artist.id,
      },
    })

    const unverified = await prisma.venue.create({
      data: {
        slug: `${VENUE_PREFIX}-hidden`,
        name: 'Hidden',
        address: '2 Secret St',
        city: 'Helsinki',
        createdBy: artist.id,
      },
    })

    const startAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)
    await prisma.venueBroadcast.create({
      data: {
        venueId: (await prisma.venue.findUnique({ where: { slug: venueSlug } }))!.id,
        artistUserId: artist.id,
        startAt,
        state: 'SCHEDULED',
        description: 'Live set',
      },
    })

    void unverified
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, VENUE_PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists only verified venues in the directory', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/venues' })
    expect(res.statusCode).toBe(200)
    const slugs = res.json().map((v: { slug: string }) => v.slug)
    expect(slugs).toContain(venueSlug)
    expect(slugs).not.toContain(`${VENUE_PREFIX}-hidden`)
  })

  it('returns venue profile and upcoming broadcasts', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/venues/${venueSlug}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().broadcasts.length).toBeGreaterThanOrEqual(1)

    const hidden = await app.inject({
      method: 'GET',
      url: `/api/v1/venues/${VENUE_PREFIX}-hidden`,
    })
    expect(hidden.statusCode).toBe(404)
  })

  it('GET broadcasts JSON feed and calendar.ics', async () => {
    const json = await app.inject({
      method: 'GET',
      url: `/api/v1/venues/${venueSlug}/broadcasts`,
    })
    expect(json.statusCode).toBe(200)
    expect(json.json().broadcasts.length).toBeGreaterThanOrEqual(1)

    const ics = await app.inject({
      method: 'GET',
      url: `/api/v1/venues/${venueSlug}/calendar.ics`,
    })
    expect(ics.statusCode).toBe(200)
    expect(ics.headers['content-type']).toContain('text/calendar')
    expect(ics.body).toContain('BEGIN:VCALENDAR')
    expect(ics.body).toContain('BEGIN:VEVENT')
  })

  it('POST /api/v1/venues creates an unverified venue', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/venues',
      headers: { cookie },
      payload: {
        slug: `${VENUE_PREFIX}-new`,
        name: 'New Venue',
        address: '3 New St',
        city: 'Tampere',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().verifiedAt).toBeNull()

    const pub = await app.inject({
      method: 'GET',
      url: `/api/v1/venues/${VENUE_PREFIX}-new`,
    })
    expect(pub.statusCode).toBe(404)
  })

  it('POST broadcasts requires auth and valid startAt', async () => {
    const unauth = await app.inject({
      method: 'POST',
      url: `/api/v1/venues/${venueSlug}/broadcasts`,
      payload: { startAt: new Date().toISOString() },
    })
    expect(unauth.statusCode).toBe(401)

    const bad = await app.inject({
      method: 'POST',
      url: `/api/v1/venues/${venueSlug}/broadcasts`,
      headers: { cookie },
      payload: { startAt: 'not-a-date' },
    })
    expect(bad.statusCode).toBe(400)

    const ok = await app.inject({
      method: 'POST',
      url: `/api/v1/venues/${venueSlug}/broadcasts`,
      headers: { cookie },
      payload: {
        startAt: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
        description: 'Second show',
      },
    })
    expect(ok.statusCode).toBe(201)
    expect(ok.json().state).toBe('SCHEDULED')
  })
})
