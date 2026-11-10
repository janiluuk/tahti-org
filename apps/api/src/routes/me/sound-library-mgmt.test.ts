// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-lib-mgmt-'

describe('library management — paged list, ids, facets, stats, bulk', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string
  let soundA: string
  let soundB: string
  let soundC: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)

    soundA = (await createReadySound(prisma, channelId, 'Alpha House')).id
    soundB = (await createReadySound(prisma, channelId, 'Beta Techno')).id
    soundC = (await createReadySound(prisma, channelId, 'Gamma Ambient')).id

    await prisma.sound.update({
      where: { id: soundA },
      data: { genre: 'House', tags: ['peak'], contentType: 'TRACK', isPublic: true },
    })
    await prisma.sound.update({
      where: { id: soundB },
      data: { genre: 'Techno', tags: ['peak', 'dark'], contentType: 'DJ_SET', isPublic: false },
    })
    await prisma.sound.update({
      where: { id: soundC },
      data: { genre: 'Ambient', tags: ['chill'], contentType: 'TRACK', isPublic: true },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('keeps the legacy array shape when limit is omitted', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/sound', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
    expect(res.json().length).toBeGreaterThanOrEqual(3)
  })

  it('returns a paged page when limit is set', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/sound?limit=2&offset=0&sort=title',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ title: string }>; total: number }
    expect(body.total).toBeGreaterThanOrEqual(3)
    expect(body.items).toHaveLength(2)
    expect(body.items[0].title <= body.items[1].title).toBe(true)
  })

  it('filters by q and genre on the paged list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/sound?limit=50&q=Techno&genre=Techno',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ id: string }>; total: number }
    expect(body.total).toBe(1)
    expect(body.items[0].id).toBe(soundB)
  })

  it('lists matching ids for select-all', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/sound/ids?contentType=TRACK',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ids: string[]; total: number }
    expect(body.total).toBe(2)
    expect(body.ids.sort()).toEqual([soundA, soundC].sort())
  })

  it('returns facets for genre and tag', async () => {
    await prisma.sound.update({
      where: { id: soundC },
      data: { genre: 'Other', genreCustom: 'IDM' },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/sound/facets?fields=genre,tag',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      total: number
      facets: {
        genre: Array<{ value: string; count: number }>
        tag: Array<{ value: string; count: number }>
      }
    }
    expect(body.total).toBeGreaterThanOrEqual(3)
    expect(body.facets.genre.some((g) => g.value === 'House' && g.count >= 1)).toBe(true)
    expect(body.facets.genre.some((g) => g.value === 'IDM' && g.count >= 1)).toBe(true)
    expect(body.facets.tag.some((t) => t.value === 'peak' && t.count >= 2)).toBe(true)
  })

  it('returns stats for a filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/sound/stats?isPublic=true',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      total: number
      publicCount: number
      privateCount: number
      readyCount: number
    }
    expect(body.total).toBe(2)
    expect(body.publicCount).toBe(2)
    expect(body.privateCount).toBe(0)
    expect(body.readyCount).toBe(2)
  })

  it('bulk-patches by ids', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-patch',
      headers: { cookie },
      payload: {
        ids: [soundA, soundC],
        patch: { genre: 'Electronic', tags: ['bulk'] },
      },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ updated: 2, totalMatched: 2, failed: [] })

    const a = await prisma.sound.findUniqueOrThrow({ where: { id: soundA } })
    expect(a.genre).toBe('Electronic')
    expect(a.tags).toEqual(['bulk'])
  })

  it('bulk-patches pinned and clears tags with tags: []', async () => {
    await prisma.sound.update({
      where: { id: soundA },
      data: { tags: ['keep-me'], pinnedAt: null },
    })
    const pin = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-patch',
      headers: { cookie },
      payload: { ids: [soundA], patch: { pinned: true } },
    })
    expect(pin.statusCode).toBe(200)
    expect(pin.json()).toMatchObject({ updated: 1, failed: [] })
    const pinned = await prisma.sound.findUniqueOrThrow({ where: { id: soundA } })
    expect(pinned.pinnedAt).toBeTruthy()

    const clear = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-patch',
      headers: { cookie },
      payload: { ids: [soundA], patch: { tags: [], pinned: false } },
    })
    expect(clear.statusCode).toBe(200)
    const cleared = await prisma.sound.findUniqueOrThrow({ where: { id: soundA } })
    expect(cleared.tags).toEqual([])
    expect(cleared.pinnedAt).toBeNull()
  })

  it('reports foreign ids in failed[] on bulk-by-ids', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-patch',
      headers: { cookie },
      payload: {
        ids: [soundA, 'sound_not_yours_or_missing'],
        patch: { genre: 'House' },
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      updated: number
      totalMatched: number
      failed: Array<{ id: string; error: string }>
    }
    expect(body.updated).toBe(1)
    expect(body.totalMatched).toBe(1)
    expect(body.failed).toEqual([
      { id: 'sound_not_yours_or_missing', error: 'not found or not owned' },
    ])
  })

  it('refuses to exceed the fallback rotation via bulk-patch', async () => {
    const { MAX_FALLBACK_ITEMS } = await import('@tahti/shared')
    const fillerIds: string[] = []
    for (let i = 0; i < MAX_FALLBACK_ITEMS; i++) {
      const id = (await createReadySound(prisma, channelId, `Fallback ${i}`)).id
      fillerIds.push(id)
      await prisma.sound.update({ where: { id }, data: { isFallback: true } })
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-patch',
      headers: { cookie },
      payload: {
        ids: [soundA, soundC],
        patch: { isFallback: true },
      },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      updated: number
      failed: Array<{ id: string; error: string }>
    }
    expect(body.updated).toBe(0)
    expect(body.failed).toHaveLength(2)
    expect(body.failed.every((f) => f.error.includes('Rotation is full'))).toBe(true)

    await prisma.sound.deleteMany({ where: { id: { in: fillerIds } } })
  })

  it('assigns preset covers on backfill for sounds without a banner', async () => {
    await prisma.artworkPreset.deleteMany({})
    await prisma.artworkPreset.create({
      data: { url: '/presets/cover-a.png', enabled: true, position: 0 },
    })
    await prisma.sound.update({ where: { id: soundA }, data: { bannerUrl: null } })
    await prisma.sound.update({
      where: { id: soundC },
      data: { bannerUrl: 'https://cdn.example/existing.jpg' },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sound/covers/backfill',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { assigned: number; totalMatched: number }
    expect(body.totalMatched).toBeGreaterThanOrEqual(1)
    expect(body.assigned).toBeGreaterThanOrEqual(1)

    const a = await prisma.sound.findUniqueOrThrow({ where: { id: soundA } })
    expect(a.bannerUrl).toBeTruthy()
    const c = await prisma.sound.findUniqueOrThrow({ where: { id: soundC } })
    expect(c.bannerUrl).toBe('https://cdn.example/existing.jpg')
  })

  it('uploadedYear facet buckets omit years outside uploadedFrom/To', async () => {
    await prisma.sound.update({
      where: { id: soundA },
      data: { createdAt: new Date('2023-06-15T12:00:00.000Z') },
    })
    await prisma.sound.update({
      where: { id: soundC },
      data: { createdAt: new Date('2025-03-01T12:00:00.000Z') },
    })
    const allYears = await app.inject({
      method: 'GET',
      url: '/api/me/sound/facets?fields=uploadedYear',
      headers: { cookie },
    })
    expect(allYears.statusCode).toBe(200)
    const allBody = allYears.json() as {
      facets: { uploadedYear: Array<{ value: string; count: number }> }
    }
    expect(allBody.facets.uploadedYear.some((y) => y.value === '2023')).toBe(true)
    expect(allBody.facets.uploadedYear.some((y) => y.value === '2025')).toBe(true)

    const filtered = await app.inject({
      method: 'GET',
      url: '/api/me/sound/facets?fields=uploadedYear&uploadedFrom=2025-01-01&uploadedTo=2025-12-31',
      headers: { cookie },
    })
    expect(filtered.statusCode).toBe(200)
    const filteredBody = filtered.json() as {
      facets: { uploadedYear: Array<{ value: string; count: number }> }
    }
    expect(filteredBody.facets.uploadedYear.every((y) => y.value === '2025')).toBe(true)
    expect(filteredBody.facets.uploadedYear.some((y) => y.value === '2023')).toBe(false)
  })

  it('bulk private→public notifies followers once per track', async () => {
    const artist = await prisma.user.findFirstOrThrow({
      where: { email: `${PREFIX}artist@example.com` },
      select: { id: true },
    })
    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}follower@example.com`,
      username: `${PREFIX}follower`,
    })
    await prisma.artistFollow.create({
      data: { artistUserId: artist.id, followerUserId: follower.id },
    })
    await prisma.sound.update({
      where: { id: soundA },
      data: { isPublic: false },
    })
    await prisma.notification.deleteMany({
      where: { type: 'NEW_TRACK', url: `/t/${soundA}` },
    })

    const first = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-patch',
      headers: { cookie },
      payload: { ids: [soundA], patch: { isPublic: true } },
    })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toMatchObject({ updated: 1, failed: [] })

    const notes = await prisma.notification.findMany({
      where: { userId: follower.id, type: 'NEW_TRACK', url: `/t/${soundA}` },
    })
    expect(notes).toHaveLength(1)

    await prisma.sound.update({
      where: { id: soundA },
      data: { isPublic: false },
    })
    const second = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-patch',
      headers: { cookie },
      payload: { ids: [soundA], patch: { isPublic: true } },
    })
    expect(second.statusCode).toBe(200)
    expect(
      await prisma.notification.count({
        where: { userId: follower.id, type: 'NEW_TRACK', url: `/t/${soundA}` },
      }),
    ).toBe(1)
  })

  it('refuses filter bulk-delete without confirmTotal / all', async () => {
    const missingConfirm = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-delete',
      headers: { cookie },
      payload: { filter: { genre: 'Techno' } },
    })
    expect(missingConfirm.statusCode).toBe(400)

    const emptyAll = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-delete',
      headers: { cookie },
      payload: { filter: {}, confirmTotal: 3 },
    })
    expect(emptyAll.statusCode).toBe(400)
  })

  it('answers 409 when confirmTotal drifts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-delete',
      headers: { cookie },
      payload: { filter: { genre: 'Techno' }, confirmTotal: 99 },
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().totalMatched).toBe(1)
  })

  it('bulk-deletes by filter with confirmTotal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/sound/bulk-delete',
      headers: { cookie },
      payload: { filter: { genre: 'Techno' }, confirmTotal: 1 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ deleted: 1, totalMatched: 1, failed: [] })
    expect(await prisma.sound.findUnique({ where: { id: soundB } })).toBeNull()
  })
})
