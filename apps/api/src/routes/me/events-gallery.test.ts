// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'events-gallery-'

describe('artist event image gallery', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  const startAt = () => new Date(Date.now() + 60 * 60_000).toISOString()

  const gallery = [
    { url: 'https://img.example.com/1.jpg', caption: 'Soundcheck' },
    { url: 'http://img.example.com/2.jpg', caption: '' },
    { url: 'https://img.example.com/3.jpg', caption: 'Encore' },
  ]

  const create = (payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: `${PREFIX}show`,
        place: 'Kaiku',
        location: 'Helsinki',
        startAt: startAt(),
        ...payload,
      },
    })

  const patch = (id: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'PATCH', url: `/api/me/events/${id}`, headers: { cookie }, payload })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('defaults to an empty gallery', async () => {
    const res = await create({})
    expect(res.statusCode).toBe(201)
    expect(res.json().gallery).toEqual([])
  })

  it('stores the gallery on create in order, trimming captions', async () => {
    const res = await create({
      gallery: [{ ...gallery[0], caption: '  Soundcheck  ' }, gallery[1], gallery[2]],
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().gallery).toEqual(gallery)

    const mine = await app.inject({ method: 'GET', url: '/api/me/events', headers: { cookie } })
    const stored = (mine.json() as Array<{ id: string; gallery: unknown }>).find(
      (e) => e.id === res.json().id,
    )
    expect(stored?.gallery).toEqual(gallery)
  })

  it('replaces the whole gallery on PATCH and leaves it alone when absent', async () => {
    const created = await create({ gallery })
    const id = created.json().id as string

    const replaced = await patch(id, {
      gallery: [{ url: 'https://img.example.com/new.jpg', caption: 'Only one' }],
    })
    expect(replaced.statusCode).toBe(200)
    expect(replaced.json().gallery).toEqual([
      { url: 'https://img.example.com/new.jpg', caption: 'Only one' },
    ])

    const untouched = await patch(id, { title: `${PREFIX}renamed` })
    expect(untouched.statusCode).toBe(200)
    expect(untouched.json().gallery).toEqual([
      { url: 'https://img.example.com/new.jpg', caption: 'Only one' },
    ])

    const cleared = await patch(id, { gallery: [] })
    expect(cleared.statusCode).toBe(200)
    expect(cleared.json().gallery).toEqual([])
  })

  it('rejects more than 30 images', async () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => ({
      url: `https://img.example.com/${i}.jpg`,
      caption: '',
    }))
    const res = await create({ gallery: tooMany })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/at most 30/)

    const okay = await create({ gallery: tooMany.slice(0, 30) })
    expect(okay.statusCode).toBe(201)
    expect(okay.json().gallery).toHaveLength(30)
  })

  it('rejects a non-http(s) image url', async () => {
    const res = await create({ gallery: [{ url: 'javascript:alert(1)', caption: '' }] })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/http\(s\)/)

    const created = await create({})
    const patched = await patch(created.json().id, {
      gallery: [{ url: 'ftp://img.example.com/1.jpg', caption: '' }],
    })
    expect(patched.statusCode).toBe(400)
  })

  it('rejects a caption over 300 characters', async () => {
    const res = await create({
      gallery: [{ url: 'https://img.example.com/1.jpg', caption: 'x'.repeat(301) }],
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/caption/)

    const okay = await create({
      gallery: [{ url: 'https://img.example.com/1.jpg', caption: 'x'.repeat(300) }],
    })
    expect(okay.statusCode).toBe(201)
  })

  it('reads malformed stored gallery JSON as an empty list', async () => {
    const created = await create({ gallery })
    const id = created.json().id as string
    await prisma.artistEvent.update({ where: { id }, data: { gallery: { not: 'a list' } } })

    const mine = await app.inject({ method: 'GET', url: '/api/me/events', headers: { cookie } })
    const stored = (mine.json() as Array<{ id: string; gallery: unknown }>).find((e) => e.id === id)
    expect(stored?.gallery).toEqual([])
  })

  it('returns the gallery on the public event, calendar and upcoming endpoints', async () => {
    // Earlier than this file's other events so it stays inside the upcoming limit.
    const created = await create({
      gallery,
      startAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    })
    expect(created.statusCode).toBe(201)
    const id = created.json().id as string

    const single = await app.inject({ method: 'GET', url: `/api/v1/events/${id}` })
    expect(single.statusCode).toBe(200)
    expect(single.json().gallery).toEqual(gallery)

    const from = new Date(Date.now() - 60_000).toISOString()
    const to = new Date(Date.now() + 2 * 60 * 60_000).toISOString()
    const calendar = await app.inject({
      method: 'GET',
      url: `/api/v1/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&artist=${PREFIX}artist`,
    })
    expect(calendar.statusCode).toBe(200)
    const inCalendar = (calendar.json() as Array<{ id: string; gallery: unknown }>).find(
      (e) => e.id === id,
    )
    expect(inCalendar?.gallery).toEqual(gallery)

    const upcoming = await app.inject({ method: 'GET', url: '/api/v1/events/upcoming?limit=50' })
    expect(upcoming.statusCode).toBe(200)
    const inUpcoming = (upcoming.json() as Array<{ id: string; gallery: unknown }>).find(
      (e) => e.id === id,
    )
    expect(inUpcoming?.gallery).toEqual(gallery)
  })
})
