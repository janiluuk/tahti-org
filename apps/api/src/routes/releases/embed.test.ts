// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  createPublishedReleaseWithTrack,
} from '../../test/helpers.js'

vi.mock('../../lib/minio.js', () => ({
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/signed-stream'),
  presignedPutUrl: vi.fn().mockResolvedValue('https://minio.test/signed-put'),
  s3: {},
}))

const PREFIX = 'embed-test-'

describe('M14 — embed and oEmbed', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let username: string
  let releaseId: string
  let smartLinkSlug: string
  let trackId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    username = 'embed-test-artist'
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98350,
    })

    smartLinkSlug = 'embed-test-release'
    const release = await createPublishedReleaseWithTrack(prisma, artist.id, {
      smartLinkSlug,
      streamKey: 'streams/embed.opus',
    })
    releaseId = release.id
    trackId = release.tracks[0].id

    await prisma.channel.update({
      where: { userId: artist.id },
      data: { state: 'LIVE' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires url on /oembed', async () => {
    const res = await app.inject({ method: 'GET', url: '/oembed' })
    expect(res.statusCode).toBe(400)
  })

  it('returns oEmbed JSON for a release smart link', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/oembed?url=${encodeURIComponent(`${config.appUrl}/r/${smartLinkSlug}`)}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json+oembed')
    const body = res.json()
    expect(body.title).toBe('Embed Test Release')
    expect(body.html).toContain(`/embed/r/${releaseId}`)
    expect(body.author_name).toBeTruthy()
  })

  it('returns oEmbed JSON for a channel URL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/oembed?url=${encodeURIComponent(`${config.appUrl}/c/${username}`)}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().html).toContain(`/embed/c/${username}`)
  })

  it('returns 404 for unknown oEmbed URLs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/oembed?url=${encodeURIComponent(`${config.appUrl}/unknown/path`)}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/v1/embed/r/:id returns track metadata', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/embed/r/${releaseId}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.tracks).toHaveLength(1)
    expect(body.tracks[0].hasStream).toBe(true)
    expect(body.embedUrl).toContain(`/embed/r/${releaseId}`)
  })

  it('GET /api/v1/embed/c/:slug exposes HLS only when LIVE', async () => {
    const live = await app.inject({ method: 'GET', url: `/api/v1/embed/c/${username}` })
    expect(live.statusCode).toBe(200)
    expect(live.json().hlsUrl).toContain(`${username}/index.m3u8`)

    await prisma.channel.update({
      where: { slug: username },
      data: { state: 'OFFLINE' },
    })
    const offline = await app.inject({ method: 'GET', url: `/api/v1/embed/c/${username}` })
    expect(offline.json().hlsUrl).toBeNull()
  })

  it('GET play endpoint returns a signed stream URL for READY tracks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/embed/r/${releaseId}/tracks/${trackId}/play`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().url).toContain('minio.test')
    expect(res.json().expiresInSec).toBe(300)
  })

  it('rejects play for draft releases', async () => {
    const draft = await prisma.release.create({
      data: {
        userId: (await prisma.user.findUnique({ where: { username } }))!.id,
        title: 'Draft',
        type: 'SINGLE',
        releaseDate: new Date(),
        smartLinkSlug: 'embed-draft-only',
        state: 'DRAFT',
        tracks: {
          create: {
            position: 1,
            title: 'X',
            status: 'READY',
            streamKey: 'streams/x.opus',
          },
        },
      },
      include: { tracks: true },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/embed/r/${draft.id}/tracks/${draft.tracks[0].id}/play`,
    })
    expect(res.statusCode).toBe(404)
  })
})
