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

const PREFIX = 'events-status-'

describe('event drafts, publishing and cancelling', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let followerId: string
  let slug: string

  const later = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
  const notes = () =>
    prisma.notification.count({ where: { userId: followerId, type: 'NEW_EVENT' } })
  const publicTitles = async () => {
    const res = await app.inject({ method: 'GET', url: `/api/channels/${slug}/events` })
    return (res.json() as Array<{ title: string; status: string }>).map(
      (e) => `${e.title}:${e.status}`,
    )
  }
  const upcomingTitles = async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/events/upcoming?limit=50' })
    return (res.json() as Array<{ title: string }>).map((e) => e.title)
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Status Artist',
    })
    const follower = await createTestArtist(prisma, {
      email: `${PREFIX}follower@example.com`,
      username: `${PREFIX}follower`,
    })
    followerId = follower.id
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.artistFollow.create({
      data: { artistUserId: artist.id, followerUserId: follower.id },
    })
    const channel = await prisma.channel.findUnique({
      where: { userId: artist.id },
      select: { slug: true },
    })
    slug = channel!.slug
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('keeps a draft private and silent, then publishes it once', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'Draft night',
        place: 'Kuudes Linja',
        location: 'Helsinki',
        startAt: later(10),
        endAt: later(10.2),
        ticketUrl: 'https://tickets.example.com/draft-night',
        status: 'DRAFT',
      },
    })
    expect(created.statusCode).toBe(201)
    const draft = created.json() as {
      id: string
      status: string
      publishedAt: string | null
      ticketUrl: string
      endAt: string
    }
    expect(draft.status).toBe('DRAFT')
    expect(draft.publishedAt).toBeNull()
    expect(draft.ticketUrl).toBe('https://tickets.example.com/draft-night')
    expect(draft.endAt).toBeTruthy()
    expect(await notes()).toBe(0)
    expect(await publicTitles()).not.toContain('Draft night:DRAFT')
    expect(await upcomingTitles()).not.toContain('Draft night')

    const mine = await app.inject({ method: 'GET', url: '/api/me/events', headers: { cookie } })
    expect((mine.json() as Array<{ title: string }>).map((e) => e.title)).toContain('Draft night')

    const published = await app.inject({
      method: 'POST',
      url: `/api/me/events/${draft.id}/publish`,
      headers: { cookie },
    })
    expect(published.statusCode).toBe(200)
    expect((published.json() as { status: string }).status).toBe('PUBLISHED')
    expect(await notes()).toBe(1)
    expect(await publicTitles()).toContain('Draft night:PUBLISHED')
    expect(await upcomingTitles()).toContain('Draft night')

    await app.inject({
      method: 'POST',
      url: `/api/me/events/${draft.id}/publish`,
      headers: { cookie },
    })
    expect(await notes()).toBe(1)
  })

  it('keeps a cancelled event on the channel but drops it from Coming up', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: { title: 'Called off', place: 'Tavastia', location: 'Helsinki', startAt: later(12) },
    })
    const { id } = created.json() as { id: string }
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/me/events/${id}/cancel`,
      headers: { cookie },
    })
    expect((cancelled.json() as { status: string }).status).toBe('CANCELLED')
    expect(await publicTitles()).toContain('Called off:CANCELLED')
    expect(await upcomingTitles()).not.toContain('Called off')
  })

  it('rejects an end before the start, on create and on edit', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'Backwards',
        place: 'Tavastia',
        location: 'Helsinki',
        startAt: later(5),
        endAt: later(4),
      },
    })
    expect(bad.statusCode).toBe(400)

    const ok = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: { title: 'Forwards', place: 'Tavastia', location: 'Helsinki', startAt: later(5) },
    })
    const { id } = ok.json() as { id: string }
    const edit = await app.inject({
      method: 'PATCH',
      url: `/api/me/events/${id}`,
      headers: { cookie },
      payload: { endAt: later(4) },
    })
    expect(edit.statusCode).toBe(400)
  })

  it('does not let another artist publish or cancel the event', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie },
      payload: {
        title: 'Mine',
        place: 'Tavastia',
        location: 'Helsinki',
        startAt: later(8),
        status: 'DRAFT',
      },
    })
    const { id } = created.json() as { id: string }
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    const otherCookie = await sessionCookieFor(prisma, other.id)
    for (const action of ['publish', 'cancel']) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/me/events/${id}/${action}`,
        headers: { cookie: otherCookie },
      })
      expect(res.statusCode).toBe(404)
    }
  })
})
