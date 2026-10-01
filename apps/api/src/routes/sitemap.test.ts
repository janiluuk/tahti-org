// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'sitemap-route-'

describe('GET /api/sitemap/*', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let publicTrackId: string
  let privateTrackId: string
  let suspendedTrackId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}suspended@example.com`,
      username: `${PREFIX}suspended`,
    })
    await prisma.user.update({
      where: { id: suspended.id },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })

    const track = (channelId: string, title: string, isPublic = true) =>
      prisma.sound.create({ data: { channelId, title, status: 'READY', isPublic } })
    publicTrackId = (await track(artist.channel!.id, 'Sitemap public')).id
    privateTrackId = (await track(artist.channel!.id, 'Sitemap private', false)).id
    suspendedTrackId = (await track(suspended.channel!.id, 'Sitemap suspended')).id

    await prisma.collection.createMany({
      data: [
        { userId: artist.id, slug: `${PREFIX}public`, name: 'Public' },
        {
          userId: artist.id,
          slug: `${PREFIX}unlisted`,
          name: 'Unlisted',
          isPublic: false,
          visibility: 'UNLISTED',
        },
        { userId: suspended.id, slug: `${PREFIX}suspended`, name: 'Suspended' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists public tracks by active accounts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sitemap/tracks.xml' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/xml/)
    expect(res.body).toContain(`/t/${publicTrackId}</loc>`)
    expect(res.body).not.toContain(privateTrackId)
    expect(res.body).not.toContain(suspendedTrackId)
  })

  it('lists public collections only', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sitemap/collections.xml' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(`/u/${PREFIX}artist/c/${PREFIX}public</loc>`)
    expect(res.body).not.toContain(`${PREFIX}unlisted`)
    expect(res.body).not.toContain(`/c/${PREFIX}suspended`)
  })

  it('lists artists with public tracks but no release, and leaves suspended ones out', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/sitemap/profiles.xml' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain(`${PREFIX}artist</loc>`)
    expect(res.body).not.toContain(`${PREFIX}suspended</loc>`)
  })
})
