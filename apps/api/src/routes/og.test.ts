// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createPublishedReleaseWithTrack,
  createTestArtist,
} from '../test/helpers.js'

const PREFIX = 'og-route-'

describe('GET /api/og/*', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artist: Awaited<ReturnType<typeof createTestArtist>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.venue.deleteMany({ where: { slug: { startsWith: 'og-route-' } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'og-route-artist',
      displayName: 'OG Route Artist',
    })
    await prisma.user.update({
      where: { id: artist.id },
      data: { bio: 'A real bio for OG tests.', avatarUrl: 'https://cdn.example/avatar.jpg' },
    })
  })

  afterAll(async () => {
    await prisma.venue.deleteMany({ where: { slug: { startsWith: 'og-route-' } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns HTML with real channel metadata', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/og/channel/og-route-artist' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('<title>OG Route Artist live on Tahti</title>')
    expect(res.body).toContain('A real bio for OG tests.')
    expect(res.body).toContain('property="og:image" content="https://cdn.example/avatar.jpg"')
  })

  it('404s with a still-valid HTML document for an unknown channel', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/og/channel/no-such-channel' })
    expect(res.statusCode).toBe(404)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('<title>Not found · Tahti</title>')
  })

  it('returns HTML with real profile metadata', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/og/profile/og-route-artist' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<title>OG Route Artist on Tahti</title>')
    expect(res.body).toContain('A real bio for OG tests.')
  })

  it('404s for an unknown profile', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/og/profile/no-such-user' })
    expect(res.statusCode).toBe(404)
  })

  it('returns HTML with real release metadata, falling back to artist avatar for image', async () => {
    const release = await createPublishedReleaseWithTrack(prisma, artist.id, {
      smartLinkSlug: 'og-route-release',
    })
    const res = await app.inject({ method: 'GET', url: `/api/og/release/${release.smartLinkSlug}` })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<title>Embed Test Release by OG Route Artist on Tahti</title>')
    expect(res.body).toContain('property="og:image" content="https://cdn.example/avatar.jpg"')
  })

  it('404s for an unknown or unpublished release', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/og/release/no-such-release' })
    expect(res.statusCode).toBe(404)
  })

  it('rejects an over-long slug as a bad request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/og/channel/${'x'.repeat(100)}`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns HTML with real collection metadata', async () => {
    await prisma.collection.create({
      data: {
        userId: artist.id,
        slug: 'og-route-collection',
        name: 'OG Route Collection',
        description: 'A real collection description for OG tests.',
        isPublic: true,
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/og/collection/og-route-collection' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<title>OG Route Collection by OG Route Artist on Tahti</title>')
    expect(res.body).toContain('A real collection description for OG tests.')
    expect(res.body).toContain('property="og:image" content="https://cdn.example/avatar.jpg"')
  })

  it('404s for a private collection instead of leaking its metadata', async () => {
    await prisma.collection.create({
      data: {
        userId: artist.id,
        slug: 'og-route-private-collection',
        name: 'OG Route Private Collection',
        isPublic: false,
      },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/og/collection/og-route-private-collection',
    })
    expect(res.statusCode).toBe(404)
  })

  it('previews an unlisted collection for people with the link, without indexing it', async () => {
    await prisma.collection.create({
      data: {
        userId: artist.id,
        slug: 'og-route-unlisted-collection',
        name: 'OG Route Unlisted Collection',
        isPublic: false,
        visibility: 'UNLISTED',
      },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/og/collection/og-route-unlisted-collection',
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(
      '<title>OG Route Unlisted Collection by OG Route Artist on Tahti</title>',
    )
    expect(res.body).toContain('<meta name="robots" content="noindex" />')
  })

  it('does not mark a public collection noindex', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/og/collection/og-route-collection' })
    expect(res.body).not.toContain('noindex')
  })

  it('returns HTML with real track metadata', async () => {
    const sound = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'OG Route Track',
        description: 'A real track description for OG tests.',
        status: 'READY',
        isPublic: true,
        bannerUrl: 'https://cdn.example/banner.jpg',
      },
    })
    const res = await app.inject({ method: 'GET', url: `/api/og/track/${sound.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<title>OG Route Track by OG Route Artist on Tahti</title>')
    expect(res.body).toContain('A real track description for OG tests.')
    expect(res.body).toContain('property="og:image" content="https://cdn.example/banner.jpg"')
    expect(res.body).toContain(`/t/${sound.id}`)
  })

  it('404s for a private or unfinished track instead of leaking its title', async () => {
    const hidden = await prisma.sound.create({
      data: {
        channelId: artist.channel!.id,
        title: 'OG Route Secret',
        isPublic: false,
        status: 'READY',
      },
    })
    const pending = await prisma.sound.create({
      data: { channelId: artist.channel!.id, title: 'OG Route Pending', isPublic: true },
    })
    for (const id of [hidden.id, pending.id]) {
      const res = await app.inject({ method: 'GET', url: `/api/og/track/${id}` })
      expect(res.statusCode).toBe(404)
      expect(res.body).not.toContain('OG Route Secret')
      expect(res.body).not.toContain('OG Route Pending')
    }
  })

  it('returns HTML with real venue metadata', async () => {
    await prisma.venue.create({
      data: {
        slug: 'og-route-venue',
        name: 'OG Route Venue',
        address: 'Testikatu 1',
        city: 'Helsinki',
        description: 'A real venue description for OG tests.',
        photos: ['https://cdn.example/venue.jpg'],
        verifiedAt: new Date(),
        createdBy: artist.id,
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/og/venue/og-route-venue' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('<title>OG Route Venue, Helsinki on Tahti</title>')
    expect(res.body).toContain('A real venue description for OG tests.')
    expect(res.body).toContain('property="og:image" content="https://cdn.example/venue.jpg"')
  })

  it('404s for an unverified venue', async () => {
    await prisma.venue.create({
      data: {
        slug: 'og-route-unverified-venue',
        name: 'OG Route Unverified Venue',
        address: 'Testikatu 2',
        city: 'Turku',
        createdBy: artist.id,
      },
    })
    const res = await app.inject({ method: 'GET', url: '/api/og/venue/og-route-unverified-venue' })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('OG Route Unverified Venue')
  })

  it('404s for an unknown collection', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/og/collection/no-such-collection' })
    expect(res.statusCode).toBe(404)
  })

  it('never names an artist or collection owner by an email address', async () => {
    const mailArtist = await createTestArtist(prisma, {
      email: `${PREFIX}mail@example.com`,
      username: 'og-route-mail',
      displayName: 'og-route-mail@example.com',
    })
    const release = await createPublishedReleaseWithTrack(prisma, mailArtist.id, {
      smartLinkSlug: 'og-route-mail-release',
    })
    const sound = await prisma.sound.create({
      data: {
        channelId: mailArtist.channel!.id,
        title: 'Mail Track',
        status: 'READY',
        isPublic: true,
      },
    })
    await prisma.collection.create({
      data: {
        userId: mailArtist.id,
        name: 'Mail Mix',
        slug: 'og-route-mail-mix',
        isPublic: true,
        visibility: 'PUBLIC',
      },
    })

    const expected = {
      '/api/og/channel/og-route-mail': '<title>og-route-mail live on Tahti</title>',
      '/api/og/profile/og-route-mail': '<title>og-route-mail on Tahti</title>',
      [`/api/og/release/${release.smartLinkSlug}`]:
        '<title>Embed Test Release by og-route-mail on Tahti</title>',
      [`/api/og/track/${sound.id}`]: '<title>Mail Track by og-route-mail on Tahti</title>',
      '/api/og/collection/og-route-mail-mix': '<title>Mail Mix by og-route-mail on Tahti</title>',
    }
    for (const [url, title] of Object.entries(expected)) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).toBe(200)
      expect(res.body, url).toContain(title)
      expect(res.body, url).not.toContain('@example.com')
    }
  })
})
