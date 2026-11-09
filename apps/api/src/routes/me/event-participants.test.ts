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

const PREFIX = 'event-tags-'

describe('tagging people on events', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let hostCookie: string
  let guestCookie: string
  let guestId: string
  let guestSlug: string

  const later = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
  const tagNotes = () =>
    prisma.notification.count({ where: { userId: guestId, type: 'EVENT_TAGGED' } })
  const createEvent = async (title: string, status: 'DRAFT' | 'PUBLISHED') => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie: hostCookie },
      payload: { title, place: 'Tavastia', location: 'Helsinki', startAt: later(9), status },
    })
    return (res.json() as { id: string }).id
  }
  const tag = (id: string, participants: Array<{ username: string; role?: string }>) =>
    app.inject({
      method: 'PUT',
      url: `/api/me/events/${id}/participants`,
      headers: { cookie: hostCookie },
      payload: { participants },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const host = await createTestArtist(prisma, {
      email: `${PREFIX}host@example.com`,
      username: `${PREFIX}host`,
      displayName: 'Tag Host',
    })
    const guest = await createTestArtist(prisma, {
      email: `${PREFIX}guest@example.com`,
      username: `${PREFIX}guest`,
      displayName: 'Tag Guest',
    })
    guestId = guest.id
    hostCookie = await sessionCookieFor(prisma, host.id)
    guestCookie = await sessionCookieFor(prisma, guest.id)
    const channel = await prisma.channel.findUnique({
      where: { userId: guest.id },
      select: { slug: true },
    })
    guestSlug = channel!.slug
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('tags silently on a draft, notifies on publish, and shows the event after accepting', async () => {
    const id = await createEvent('Split bill', 'DRAFT')
    const tagged = await tag(id, [{ username: `@${PREFIX}guest`, role: 'PERFORMER' }])
    expect(tagged.statusCode).toBe(200)
    const body = tagged.json() as { participants: Array<{ username: string; status: string }> }
    expect(body.participants).toEqual([
      expect.objectContaining({ username: `${PREFIX}guest`, status: 'PENDING' }),
    ])
    expect(await tagNotes()).toBe(0)

    await app.inject({
      method: 'POST',
      url: `/api/me/events/${id}/publish`,
      headers: { cookie: hostCookie },
    })
    expect(await tagNotes()).toBe(1)

    const invites = await app.inject({
      method: 'GET',
      url: '/api/me/event-invites',
      headers: { cookie: guestCookie },
    })
    const list = invites.json() as Array<{ event: { id: string }; status: string }>
    expect(list.map((i) => `${i.event.id}:${i.status}`)).toContain(`${id}:PENDING`)

    const before = await app.inject({ method: 'GET', url: `/api/channels/${guestSlug}/events` })
    expect((before.json() as Array<{ id: string }>).map((e) => e.id)).not.toContain(id)

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/me/event-invites/${id}/accept`,
      headers: { cookie: guestCookie },
    })
    expect(accepted.statusCode).toBe(204)
    const after = await app.inject({ method: 'GET', url: `/api/channels/${guestSlug}/events` })
    const onChannel = (after.json() as Array<{ id: string; participants: unknown[] }>).find(
      (e) => e.id === id,
    )
    expect(onChannel?.participants).toEqual([
      expect.objectContaining({ username: `${PREFIX}guest`, status: 'ACCEPTED' }),
    ])
  })

  it('notifies a person added to an already published event, and nobody twice', async () => {
    const id = await createEvent('Late add', 'PUBLISHED')
    const before = await tagNotes()
    await tag(id, [{ username: `${PREFIX}guest` }])
    expect(await tagNotes()).toBe(before + 1)
    await tag(id, [{ username: `${PREFIX}guest`, role: 'HOST' }])
    expect(await tagNotes()).toBe(before + 1)
  })

  it('declines, drops removed people and rejects unknown accounts', async () => {
    const id = await createEvent('Maybe not', 'PUBLISHED')
    await tag(id, [{ username: `${PREFIX}guest` }])
    const declined = await app.inject({
      method: 'POST',
      url: `/api/me/event-invites/${id}/decline`,
      headers: { cookie: guestCookie },
    })
    expect(declined.statusCode).toBe(204)

    const cleared = await tag(id, [])
    expect((cleared.json() as { participants: unknown[] }).participants).toEqual([])

    const unknown = await tag(id, [{ username: `${PREFIX}nobody` }])
    expect(unknown.statusCode).toBe(400)

    const gone = await app.inject({
      method: 'POST',
      url: `/api/me/event-invites/${id}/accept`,
      headers: { cookie: guestCookie },
    })
    expect(gone.statusCode).toBe(404)
  })
})
