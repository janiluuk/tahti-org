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
