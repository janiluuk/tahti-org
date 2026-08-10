// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'public-profile-'

describe('GET /api/v1/u/:username/profile', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'public-profile-artist',
    })
    await prisma.user.update({
      where: { id: artist.id },
      data: { countryCode: 'FI', pronouns: 'she/her' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns countryCode and pronouns on the public artist object', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-artist/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { artist: { countryCode?: string | null; pronouns?: string | null } }
    expect(body.artist.countryCode).toBe('FI')
    expect(body.artist.pronouns).toBe('she/her')
  })

  it('includes collection style so the profile page can group DJ mixes/playlists/collections', async () => {
    await prisma.collection.create({
      data: {
        userId: (
          await prisma.user.findUniqueOrThrow({
            where: { username: 'public-profile-artist' },
            select: { id: true },
          })
        ).id,
        slug: `${PREFIX}dj-mix`,
        name: 'Test DJ Mix',
        style: 'DJ_SET_SERIES',
        isPublic: true,
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-artist/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { collections: Array<{ slug: string; style: string }> }
    const collection = body.collections.find((c) => c.slug === `${PREFIX}dj-mix`)
    expect(collection).toBeTruthy()
    expect(collection!.style).toBe('DJ_SET_SERIES')
  })

  it('lists all ready archive items under tracks, flagging pinned ones', async () => {
    const artist = await prisma.user.findUniqueOrThrow({
      where: { username: 'public-profile-artist' },
      select: { id: true, channel: { select: { id: true } } },
    })
    const item = await createReadyArchiveItem(prisma, artist.channel!.id, 'Pinned track')
    await prisma.archiveItem.update({ where: { id: item.id }, data: { pinnedAt: new Date() } })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-artist/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      tracks: Array<{ id: string; title: string; pinned: boolean }>
    }
    const track = body.tracks.find((t) => t.id === item.id)
    expect(track).toBeTruthy()
    expect(track!.title).toBe('Pinned track')
    expect(track!.pinned).toBe(true)
  })

  it('links a track to its Release via releaseSlug when it belongs to one', async () => {
    const artist = await prisma.user.findUniqueOrThrow({
      where: { username: 'public-profile-artist' },
      select: { id: true, channel: { select: { id: true } } },
    })
    const item = await createReadyArchiveItem(prisma, artist.channel!.id, 'Album track')
    const release = await prisma.release.create({
      data: {
        userId: artist.id,
        title: 'Test Album',
        type: 'ALBUM',
        releaseDate: new Date(),
        smartLinkSlug: `${PREFIX}test-album`,
        state: 'PUBLISHED',
        tracks: {
          create: { position: 1, title: 'Album track', archiveItemId: item.id },
        },
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-artist/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { tracks: Array<{ id: string; releaseSlug: string | null }> }
    const track = body.tracks.find((t) => t.id === item.id)
    expect(track?.releaseSlug).toBe(release.smartLinkSlug)
  })
})
