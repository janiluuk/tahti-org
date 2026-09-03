// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'search-test-'

describe('GET /api/v1/search', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'search-test-moonrise',
      displayName: 'DJ Moonrise',
      tier: 'ARTIST',
    })
    channelId = artist.channel!.id

    await prisma.sound.create({
      data: {
        channelId,
        title: 'Midnight Ambient Set',
        status: 'READY',
        isPublic: true,
        durationSec: 1800,
        rawKey: `raw/${channelId}.wav`,
        mp3Key: `mp3/${channelId}.mp3`,
        fileSizeBytes: BigInt(1000),
      },
    })
    await prisma.sound.create({
      data: {
        channelId,
        title: 'Private Rehearsal',
        status: 'READY',
        isPublic: false,
        rawKey: `raw/${channelId}-2.wav`,
        mp3Key: `mp3/${channelId}-2.mp3`,
        fileSizeBytes: BigInt(1000),
      },
    })
    await prisma.collection.create({
      data: {
        userId: artist.id,
        slug: 'search-test-moonlight-mixes',
        name: 'Moonlight Mixes',
        isPublic: true,
      },
    })
  })

  afterAll(async () => {
    await prisma.sound.deleteMany({ where: { channelId } })
    await prisma.collection.deleteMany({ where: { slug: 'search-test-moonlight-mixes' } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires q', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/search' })
    expect(res.statusCode).toBe(400)
  })

  it('finds a public track by title, case-insensitive', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/search?q=midnight+ambient' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.tracks).toHaveLength(1)
    expect(body.tracks[0]).toMatchObject({
      title: 'Midnight Ambient Set',
      artistName: 'DJ Moonrise',
      durationSec: 1800,
    })
  })

  it('excludes non-public tracks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/search?q=rehearsal' })
    expect(res.json().tracks).toHaveLength(0)
  })

  it('finds an artist by display name', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/search?q=moonrise' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.artists).toHaveLength(1)
    expect(body.artists[0]).toMatchObject({
      username: 'search-test-moonrise',
      displayName: 'DJ Moonrise',
    })
  })

  it('finds a public collection by name', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/search?q=moonlight+mixes' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.collections).toHaveLength(1)
    expect(body.collections[0]).toMatchObject({
      slug: 'search-test-moonlight-mixes',
      name: 'Moonlight Mixes',
      ownerUsername: 'search-test-moonrise',
      ownerDisplayName: 'DJ Moonrise',
    })
  })

  it('scopes to tracks-only or artists-only via type', async () => {
    const tracksOnly = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=moonrise&type=tracks',
    })
    expect(tracksOnly.json().artists).toEqual([])

    const artistsOnly = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=midnight&type=artists',
    })
    expect(artistsOnly.json().tracks).toEqual([])
  })

  it('returns empty results for no match (different data shape: empty arrays)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/search?q=zzz-no-such-thing-zzz' })
    expect(res.json()).toEqual({ tracks: [], artists: [], collections: [] })
  })
})
