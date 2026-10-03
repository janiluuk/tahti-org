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

const PREFIX = 'events-edit-'

describe('editing an artist event', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let followerId: string

  const startAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString()

  const addEvent = async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'Release show',
        description: 'Doors 18:00',
        place: 'Kaiku',
        location: 'Helsinki',
        eventUrl: 'https://tickets.example.com/old',
        startAt,
      },
    })
    expect(res.statusCode).toBe(201)
    return res.json() as { id: string }
  }

  const patch = (id: string, payload: Record<string, unknown>, asCookie = cookie) =>
    app.inject({
      method: 'PATCH',
      url: `/api/me/events/${id}`,
      headers: { cookie: asCookie },
      payload,
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}follower@example.com`,
      username: `${PREFIX}follower`,
    })
    followerId = follower.id
    cookie = await sessionCookieFor(prisma, artist.id)
    otherCookie = await sessionCookieFor(prisma, other.id)
    await prisma.artistFollow.create({
      data: { artistUserId: artist.id, followerUserId: follower.id },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('updates only the fields sent and keeps the rest', async () => {
    const event = await addEvent()
    const newStart = new Date(Date.now() + 14 * 24 * 3600_000).toISOString()

    const res = await patch(event.id, {
      startAt: newStart,
      eventUrl: 'https://tickets.example.com/new',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      id: event.id,
      title: 'Release show',
      description: 'Doors 18:00',
      place: 'Kaiku',
      location: 'Helsinki',
      eventUrl: 'https://tickets.example.com/new',
      startAt: newStart,
    })

    const mine = await app.inject({ method: 'GET', url: '/api/me/events', headers: { cookie } })
    const stored = (mine.json() as { id: string; startAt: string }[]).find((e) => e.id === event.id)
    expect(stored?.startAt).toBe(newStart)
  })

  it('clears the ticket link and description when sent empty', async () => {
    const event = await addEvent()
    const res = await patch(event.id, { eventUrl: '', description: '' })
    expect(res.statusCode).toBe(200)
    expect(res.json().eventUrl).toBeNull()
    expect(res.json().description).toBeNull()
  })

  it('does not notify followers again on edit', async () => {
    const event = await addEvent()
    const before = await prisma.notification.count({
      where: { userId: followerId, type: 'NEW_EVENT' },
    })
    expect(before).toBeGreaterThan(0)

    const res = await patch(event.id, { title: 'Release show (moved)' })
    expect(res.statusCode).toBe(200)

    const after = await prisma.notification.count({
      where: { userId: followerId, type: 'NEW_EVENT' },
    })
    expect(after).toBe(before)
  })

  it('applies the create validation', async () => {
    const event = await addEvent()
    expect((await patch(event.id, { title: '  ' })).statusCode).toBe(400)
    expect((await patch(event.id, { eventUrl: 'ftp://x' })).statusCode).toBe(400)
    expect((await patch(event.id, { startAt: 'next friday' })).statusCode).toBe(400)
    expect((await patch(event.id, {})).statusCode).toBe(400)
  })

  it("returns 404 for another artist's event and leaves it unchanged", async () => {
    const event = await addEvent()
    const res = await patch(event.id, { title: 'Hijacked' }, otherCookie)
    expect(res.statusCode).toBe(404)
    const stored = await prisma.artistEvent.findUniqueOrThrow({ where: { id: event.id } })
    expect(stored.title).toBe('Release show')
  })

  it('requires a session', async () => {
    const event = await addEvent()
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/me/events/${event.id}`,
      payload: { title: 'Anon' },
    })
    expect(res.statusCode).toBe(401)
  })
})
