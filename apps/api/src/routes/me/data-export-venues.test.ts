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

const PREFIX = 'export-venues-'

describe('GET /api/me/data-export.json — venues and venue shows', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.venue.create({
      data: {
        slug: `${PREFIX}mine`,
        name: 'Kellari',
        address: '1 Test St',
        city: 'Helsinki',
        createdBy: artist.id,
      },
    })
    const elsewhere = await prisma.venue.create({
      data: {
        slug: `${PREFIX}theirs`,
        name: 'Tavastia',
        address: '2 Test St',
        city: 'Helsinki',
        createdBy: other.id,
      },
    })
    await prisma.venueBroadcast.createMany({
      data: [
        {
          venueId: elsewhere.id,
          artistUserId: artist.id,
          startAt: new Date('2026-12-04T19:00:00Z'),
        },
        {
          venueId: elsewhere.id,
          artistUserId: other.id,
          startAt: new Date('2026-12-05T19:00:00Z'),
        },
      ],
    })
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the venues the account runs and the shows it booked', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.venues).toEqual([
      expect.objectContaining({ slug: `${PREFIX}mine`, name: 'Kellari', city: 'Helsinki' }),
    ])
    expect(body.venueShows).toEqual([
      expect.objectContaining({
        startAt: '2026-12-04T19:00:00.000Z',
        state: 'SCHEDULED',
        venue: { slug: `${PREFIX}theirs`, name: 'Tavastia' },
      }),
    ])
  })
})
