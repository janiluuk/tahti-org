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
})
