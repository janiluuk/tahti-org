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

const PREFIX = 'event-cal-'

describe('event calendar and iCalendar feeds', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let hostCookie: string
  let guestCookie: string
  const ids: Record<string, string> = {}

  const at = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()
  const create = async (
    title: string,
    days: number,
    status: 'DRAFT' | 'PUBLISHED' = 'PUBLISHED',
  ) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/events',
      headers: { cookie: hostCookie },
      payload: { title, place: 'Tavastia', location: 'Helsinki', startAt: at(days), status },
    })
    ids[title] = (res.json() as { id: string }).id
  }
  const range = (fromDays: number, toDays: number, artist?: string) =>
    `/api/v1/events?from=${encodeURIComponent(at(fromDays))}&to=${encodeURIComponent(at(toDays))}${
      artist ? `&artist=${artist}` : ''
    }`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const host = await createTestArtist(prisma, {
      email: `${PREFIX}host@example.com`,
      username: `${PREFIX}host`,
      displayName: 'Calendar Host',
    })
    const guest = await createTestArtist(prisma, {
      email: `${PREFIX}guest@example.com`,
      username: `${PREFIX}guest`,
    })
    hostCookie = await sessionCookieFor(prisma, host.id)
    guestCookie = await sessionCookieFor(prisma, guest.id)
    await create('Week one; night', 3)
    await create('Week two', 10)
    await create('Draft only', 4, 'DRAFT')
    await create('Called off', 5)
    await app.inject({
      method: 'POST',
      url: `/api/me/events/${ids['Called off']}/cancel`,
      headers: { cookie: hostCookie },
    })
    await app.inject({
      method: 'PUT',
      url: `/api/me/events/${ids['Week two']}/participants`,
      headers: { cookie: hostCookie },
      payload: { participants: [{ username: `${PREFIX}guest` }] },
    })
    await app.inject({
      method: 'POST',
      url: `/api/me/event-invites/${ids['Week two']}/accept`,
      headers: { cookie: guestCookie },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists published and cancelled events in the range, never drafts', async () => {
    const res = await app.inject({ method: 'GET', url: range(0, 7, `${PREFIX}host`) })
    expect(res.statusCode).toBe(200)
    const titles = (res.json() as Array<{ title: string; status: string }>).map(
      (e) => `${e.title}:${e.status}`,
    )
    expect(titles).toEqual(['Week one; night:PUBLISHED', 'Called off:CANCELLED'])
  })

  it("finds an artist's accepted tags through the artist filter", async () => {
    const res = await app.inject({ method: 'GET', url: range(0, 30, `${PREFIX}guest`) })
    const events = res.json() as Array<{ title: string; artistUsername: string }>
    expect(events.map((e) => e.title)).toEqual(['Week two'])
    expect(events[0]!.artistUsername).toBe(`${PREFIX}host`)
  })

  it('rejects ranges over 92 days or backwards', async () => {
    expect((await app.inject({ method: 'GET', url: range(0, 100) })).statusCode).toBe(400)
    expect((await app.inject({ method: 'GET', url: range(5, 1) })).statusCode).toBe(400)
  })

  it('serves an iCalendar feed per artist with escaped text and cancelled status', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/u/${PREFIX}host/events.ics` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/calendar')
    const body = res.body
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('SUMMARY:Week one\\; night — Calendar Host')
    expect(body).toContain('STATUS:CANCELLED')
    expect(body).not.toContain('Draft only')

    const guestFeed = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${PREFIX}guest/events.ics`,
    })
    expect(guestFeed.body).toContain('SUMMARY:Week two — Calendar Host')
  })

  it('serves the site-wide feed with published events only', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/events.ics' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Week two')
    expect(res.body).not.toContain('Called off')
    expect(res.body).not.toContain('Draft only')
  })
})
