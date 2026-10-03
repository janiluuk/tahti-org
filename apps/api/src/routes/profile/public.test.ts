// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
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
      data: {
        countryCode: 'FI',
        pronouns: 'she/her',
        fullBio: 'A much longer history of how this project got started.',
        backdropUrl: 'https://media.tahti.live/avatars/public-profile-artist/backdrop-1.jpg',
        nameplateText: 'DJ · Producer',
        nameplateColor: '#5865f2',
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns countryCode, pronouns, and isMember on the public artist object', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-artist/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      artist: {
        countryCode?: string | null
        pronouns?: string | null
        fullBio?: string | null
        isMember?: boolean
        backdropUrl?: string | null
        nameplateText?: string | null
        nameplateColor?: string | null
      }
    }
    expect(body.artist.countryCode).toBe('FI')
    expect(body.artist.pronouns).toBe('she/her')
    expect(body.artist.fullBio).toBe('A much longer history of how this project got started.')
    expect(body.artist.isMember).toBe(false)
    expect(body.artist.backdropUrl).toContain('backdrop-1.jpg')
    expect(body.artist.nameplateText).toBe('DJ · Producer')
    expect(body.artist.nameplateColor).toBe('#5865f2')
  })

  it('sets isMember true when the artist is a Tahti ry member', async () => {
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: 'public-profile-member',
      isMember: true,
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-member/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { artist: { isMember?: boolean; username: string } }
    expect(body.artist.username).toBe(member.username)
    expect(body.artist.isMember).toBe(true)
  })

  it('returns showPageHero so the profile page can hide its hero', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}nohero@example.com`,
      username: 'public-profile-nohero',
    })
    const fetchShowPageHero = async (username: string) =>
      (
        (await app.inject({ method: 'GET', url: `/api/v1/u/${username}/profile` })).json() as {
          artist: { showPageHero?: boolean }
        }
      ).artist.showPageHero

    expect(await fetchShowPageHero('public-profile-artist')).toBe(true)
    await prisma.user.update({ where: { id: artist.id }, data: { showPageHero: false } })
    expect(await fetchShowPageHero('public-profile-nohero')).toBe(false)
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

  it('orders public collections by the saved profile order after featured ones', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}grid@example.com`,
      username: 'public-profile-grid',
    })
    const make = (
      slug: string,
      data: { publicProfileOrder?: number; isFeatured?: boolean; createdAt: Date },
    ) =>
      prisma.collection.create({
        data: { userId: artist.id, slug: `${PREFIX}${slug}`, name: slug, isPublic: true, ...data },
      })
    await make('a', { createdAt: new Date('2026-01-01'), publicProfileOrder: 1 })
    await make('b', { createdAt: new Date('2026-02-01'), publicProfileOrder: 0 })
    await make('c', { createdAt: new Date('2026-03-01'), publicProfileOrder: 2 })
    await make('featured', {
      createdAt: new Date('2025-01-01'),
      publicProfileOrder: 3,
      isFeatured: true,
    })

    const res = await app.inject({ method: 'GET', url: '/api/v1/u/public-profile-grid/profile' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { collections: Array<{ name: string }> }
    expect(body.collections.map((c) => c.name)).toEqual(['featured', 'b', 'a', 'c'])
  })

  it('lists all ready sound items under tracks, flagging pinned ones', async () => {
    const artist = await prisma.user.findUniqueOrThrow({
      where: { username: 'public-profile-artist' },
      select: { id: true, channel: { select: { id: true } } },
    })
    const item = await createReadySound(prisma, artist.channel!.id, 'Pinned track')
    await prisma.sound.update({ where: { id: item.id }, data: { pinnedAt: new Date() } })

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

  it('lists tracks in the order saved by PUT /api/me/sound/reorder, newest first by default', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}order@example.com`,
      username: 'public-profile-order',
    })
    const channelId = (
      await prisma.channel.findUniqueOrThrow({ where: { userId: artist.id }, select: { id: true } })
    ).id
    const first = await createReadySound(prisma, channelId, 'First upload')
    const second = await createReadySound(prisma, channelId, 'Second upload')
    const third = await createReadySound(prisma, channelId, 'Third upload')
    await prisma.sound.update({
      where: { id: first.id },
      data: { createdAt: new Date('2026-01-01') },
    })
    await prisma.sound.update({
      where: { id: second.id },
      data: { createdAt: new Date('2026-02-01') },
    })
    await prisma.sound.update({
      where: { id: third.id },
      data: { createdAt: new Date('2026-03-01') },
    })

    const titles = async () =>
      (
        (
          await app.inject({ method: 'GET', url: '/api/v1/u/public-profile-order/profile' })
        ).json() as { tracks: Array<{ title: string }> }
      ).tracks.map((t) => t.title)

    expect(await titles()).toEqual(['Third upload', 'Second upload', 'First upload'])

    await prisma.sound.update({ where: { id: first.id }, data: { trackOrder: 0 } })
    await prisma.sound.update({ where: { id: third.id }, data: { trackOrder: 1 } })
    await prisma.sound.update({ where: { id: second.id }, data: { trackOrder: 2 } })
    expect(await titles()).toEqual(['First upload', 'Third upload', 'Second upload'])
  })

  it('links a track to its Release via releaseSlug when it belongs to one', async () => {
    const artist = await prisma.user.findUniqueOrThrow({
      where: { username: 'public-profile-artist' },
      select: { id: true, channel: { select: { id: true } } },
    })
    const item = await createReadySound(prisma, artist.channel!.id, 'Album track')
    const release = await prisma.release.create({
      data: {
        userId: artist.id,
        title: 'Test Album',
        type: 'ALBUM',
        releaseDate: new Date(),
        smartLinkSlug: `${PREFIX}test-album`,
        state: 'PUBLISHED',
        tracks: {
          create: { position: 1, title: 'Album track', soundId: item.id },
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

  it('nulls playUrl with a gate for subscriber-only tracks viewed anonymously', async () => {
    const artist = await prisma.user.findUniqueOrThrow({
      where: { username: 'public-profile-artist' },
      select: { id: true, channel: { select: { id: true } } },
    })
    const item = await createReadySound(prisma, artist.channel!.id, 'Gated track')
    await prisma.sound.update({
      where: { id: item.id },
      data: { accessMode: 'SUBSCRIBERS_ONLY' },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-artist/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      tracks: Array<{
        id: string
        playUrl: string | null
        accessMode: string
        gate: { reason: string } | null
      }>
    }
    const track = body.tracks.find((t) => t.id === item.id)
    expect(track).toBeTruthy()
    expect(track!.accessMode).toBe('SUBSCRIBERS_ONLY')
    expect(track!.playUrl).toBeNull()
    expect(track!.gate?.reason).toBe('SUBSCRIBERS_ONLY')
  })

  it('keeps a pinned release that is older than the 24 newest, listing pinned releases first', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}many-releases@example.com`,
      username: 'public-profile-many-releases',
    })
    const base = Date.UTC(2020, 0, 1)
    const day = 24 * 60 * 60 * 1000
    await prisma.release.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        userId: artist.id,
        title: `Release ${i}`,
        type: 'SINGLE' as const,
        releaseDate: new Date(base + i * day),
        smartLinkSlug: `${PREFIX}many-${i}`,
        state: 'PUBLISHED' as const,
      })),
    })
    await prisma.release.update({
      where: { smartLinkSlug: `${PREFIX}many-0` },
      data: { pinnedAt: new Date(base + 100 * day) },
    })
    await prisma.release.update({
      where: { smartLinkSlug: `${PREFIX}many-1` },
      data: { pinnedAt: new Date(base + 200 * day) },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-many-releases/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { releases: Array<{ title: string; pinned: boolean }> }
    expect(body.releases).toHaveLength(24)
    expect(body.releases.slice(0, 4).map((r) => r.title)).toEqual([
      'Release 1',
      'Release 0',
      'Release 29',
      'Release 28',
    ])
    expect(body.releases.slice(0, 3).map((r) => r.pinned)).toEqual([true, true, false])
  })

  it('returns the description and perks of active fan tiers only', async () => {
    const artist = await prisma.user.findUniqueOrThrow({
      where: { username: 'public-profile-artist' },
      select: { id: true },
    })
    await prisma.fanTier.createMany({
      data: [
        {
          artistUserId: artist.id,
          name: 'Supporter',
          amountCents: 500,
          description: 'Keeps the lights on.',
          perks: ['FAN_CHAT', 'Signed postcard'],
          position: 0,
        },
        {
          artistUserId: artist.id,
          name: 'Retired',
          amountCents: 900,
          description: 'No longer offered.',
          perks: ['FAN_NEWSLETTER'],
          active: false,
          position: 1,
        },
      ],
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/public-profile-artist/profile',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      fanTiers: Array<{
        name: string
        amountCents: number
        description: string | null
        perks: string[]
      }>
    }
    expect(body.fanTiers).toHaveLength(1)
    expect(body.fanTiers[0]).toMatchObject({
      name: 'Supporter',
      amountCents: 500,
      description: 'Keeps the lights on.',
      perks: ['FAN_CHAT', 'Signed postcard'],
    })
  })
})

describe('GET /api/v1/u/:username/news', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await createTestArtist(prisma, {
      email: `${PREFIX}news@example.com`,
      username: 'public-news-artist',
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns an empty list when the artist has no feed configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/u/public-news-artist/news' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ items: [] })
  })

  it('fails soft to an empty list when the configured feed is disallowed (SSRF guard)', async () => {
    await prisma.user.update({
      where: { username: 'public-news-artist' },
      data: { newsFeedUrl: 'http://127.0.0.1/feed.xml' },
    })
    const res = await app.inject({ method: 'GET', url: '/api/v1/u/public-news-artist/news' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ items: [] })
  })

  it('returns an empty list (not a 404) for an unknown username', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/u/nonexistent-user-xyz/news' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ items: [] })
  })
})
