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

const PREFIX = 'venue-bcheck-'

const inDays = (days: number) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()

describe('venue show booking checks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let ownChannelId: string
  let otherChannelId: string
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
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
      tier: 'ARTIST',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    ownChannelId = artist.channel!.id
    otherChannelId = other.channel!.id

    await prisma.venue.create({
      data: {
        slug,
        name: 'Check Club',
        address: '1 Test St',
        city: 'Helsinki',
        verifiedAt: new Date(),
        createdBy: artist.id,
      },
    })
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it("refuses to credit a new show to another artist's channel", async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/venues/${slug}/broadcasts`,
      headers: { cookie },
      payload: { startAt: inDays(3), channelId: otherChannelId },
    })
    expect(res.statusCode).toBe(403)
    expect(await prisma.venueBroadcast.count({ where: { channelId: otherChannelId } })).toBe(0)
  })

  it("credits a new show to the caller's own channel", async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/venues/${slug}/broadcasts`,
      headers: { cookie },
      payload: { startAt: inDays(3), channelId: ownChannelId },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().channelId).toBe(ownChannelId)
  })

  it('refuses a show that ends before it starts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/venues/${slug}/broadcasts`,
      headers: { cookie },
      payload: { startAt: inDays(3), endAt: inDays(2) },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('The show must end after it starts')
  })

  it('refuses moving a show start past its end', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/api/v1/venues/${slug}/broadcasts`,
      headers: { cookie },
      payload: { startAt: inDays(5), endAt: inDays(6) },
    })
    expect(created.statusCode).toBe(201)

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/venues/${slug}/broadcasts/${created.json().id}`,
      headers: { cookie },
      payload: { startAt: inDays(7) },
    })
    expect(res.statusCode).toBe(400)
  })
})
