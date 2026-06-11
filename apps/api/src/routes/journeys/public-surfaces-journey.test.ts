// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Public surfaces journey — Home, Discover, Radio, Venues (Phase 2 unified test plan).
 * Exercises the API layer backing top-nav pages without auth.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import {
  cleanupUsersByEmailPrefix,
  cleanupVenuesBySlugPrefix,
  createTahtiRadioChannel,
  createTestArtist,
} from '../../test/helpers.js'

const USER_PREFIX = 'public-surfaces-'
const VENUE_PREFIX = 'public-surfaces-venue'

describe('Public surfaces journey (Home · Discover · Radio · Venues)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, USER_PREFIX)
    await cleanupVenuesBySlugPrefix(prisma, VENUE_PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${USER_PREFIX}artist@example.com`,
      username: `${USER_PREFIX}artist`,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98420,
    })
    await prisma.channel.update({
      where: { id: artist.channel!.id },
      data: { state: 'LIVE', goneLiveAt: new Date() },
    })

    await createTahtiRadioChannel(prisma)

    await prisma.venue.create({
      data: {
        slug: `${VENUE_PREFIX}-hall`,
        name: 'Public Surfaces Hall',
        address: '1 Stage Rd',
        city: 'Helsinki',
        countryCode: 'FI',
        verifiedAt: new Date(),
        createdBy: artist.id,
      },
    })

    await prisma.venue.create({
      data: {
        slug: `${VENUE_PREFIX}-pending`,
        name: 'Pending Venue',
        address: '2 Back Rd',
        city: 'Tampere',
        createdBy: artist.id,
      },
    })
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, VENUE_PREFIX)
    await cleanupUsersByEmailPrefix(prisma, USER_PREFIX)
    await cleanupUsersByEmailPrefix(prisma, 'journey-tahti-radio-')
    await cleanupUsersByEmailPrefix(prisma, 'tahti-radio@')
    await app.close()
    vi.unstubAllGlobals()
  })

  it('home and discover: platform stats + channel directory', async () => {
    const stats = await app.inject({ method: 'GET', url: '/api/v1/stats' })
    expect(stats.statusCode).toBe(200)
    expect(stats.json().activeArtists).toBeGreaterThanOrEqual(1)

    const channels = await app.inject({ method: 'GET', url: '/api/v1/channels' })
    expect(channels.statusCode).toBe(200)
    const live = channels.json().live as Array<{ slug: string }>
    expect(live.some((c) => c.slug === `${USER_PREFIX}artist`)).toBe(true)
  })

  it('radio: now-playing proxy and tahti-radio channel chat', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ live: false, channel: null }), { status: 200 }),
        ),
    )

    const nowPlaying = await app.inject({ method: 'GET', url: '/api/v1/radio' })
    expect(nowPlaying.statusCode).toBe(200)
    expect(nowPlaying.json().live).toBe(false)

    const radioChannel = await app.inject({
      method: 'GET',
      url: `/api/channels/${TAHTI_RADIO_SLUG}`,
    })
    expect(radioChannel.statusCode).toBe(200)
    expect(radioChannel.json().slug).toBe(TAHTI_RADIO_SLUG)

    const chatAccess = await app.inject({
      method: 'GET',
      url: `/api/chat/${TAHTI_RADIO_SLUG}/access`,
    })
    expect(chatAccess.statusCode).toBe(200)
  })

  it('venues: directory lists verified venues only', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/v1/venues' })
    expect(list.statusCode).toBe(200)
    const slugs = (list.json() as Array<{ slug: string }>).map((v) => v.slug)
    expect(slugs).toContain(`${VENUE_PREFIX}-hall`)
    expect(slugs).not.toContain(`${VENUE_PREFIX}-pending`)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/v1/venues/${VENUE_PREFIX}-hall`,
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().name).toBe('Public Surfaces Hall')
  })

  it('transparency footer links resolve for anonymous visitors', async () => {
    const ytd = await app.inject({ method: 'GET', url: '/api/v1/transparency/ytd' })
    expect(ytd.statusCode).toBe(200)

    const status = await app.inject({ method: 'GET', url: '/api/v1/status' })
    expect([200, 503]).toContain(status.statusCode)
    expect(status.json().checks?.postgres?.state).toBe('up')
  })
})
