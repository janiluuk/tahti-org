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

const PREFIX = 'events-description-'

describe('artist event description', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let slug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'events-description',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const channel = await prisma.channel.findUniqueOrThrow({
      where: { userId: artist.id },
      select: { slug: true },
    })
    slug = channel.slug
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const startAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString()

  it('stores the description and returns it from the artist and public lists', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'Release show',
        description: 'Doors 18:00, the full record start to finish.',
        place: 'Kaiku',
        location: 'Helsinki',
        startAt,
      },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json().description).toBe('Doors 18:00, the full record start to finish.')

    const mine = await app.inject({ method: 'GET', url: '/api/me/events', headers: { cookie } })
    expect(mine.json()[0].description).toBe('Doors 18:00, the full record start to finish.')

    const pub = await app.inject({ method: 'GET', url: `/api/channels/${slug}/events` })
    expect(pub.statusCode).toBe(200)
    expect(pub.json()[0].description).toBe('Doors 18:00, the full record start to finish.')
  })

  it('stores an empty description as null', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'DJ set',
        description: '  ',
        place: 'Kaiku',
        location: 'Helsinki',
        startAt,
      },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json().description).toBeNull()
  })
})
