// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'channel-members-'

describe('M36 — channel members / credits roster', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let channelSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'channel-members-artist',
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelSlug = artist.channel!.slug

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'channel-members-other',
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('starts empty, both privately and publicly', async () => {
    const mine = await app.inject({
      method: 'GET',
      url: '/api/me/channel/members',
      headers: { cookie },
    })
    expect(mine.json()).toEqual([])

    const pub = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelSlug}/members`,
    })
    expect(pub.statusCode).toBe(200)
    expect(pub.json()).toEqual([])
  })

  it('adds members in order and exposes them publicly', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/me/channel/members',
      headers: { cookie },
      payload: { name: 'Alex Rivera', role: 'Vocals' },
    })
    expect(first.statusCode).toBe(201)
    expect(first.json().position).toBe(0)

    const second = await app.inject({
      method: 'POST',
      url: '/api/me/channel/members',
      headers: { cookie },
      payload: { name: 'Abbey Road Studios', role: 'Mixing House' },
    })
    expect(second.statusCode).toBe(201)
    expect(second.json().position).toBe(1)

    const pub = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelSlug}/members`,
    })
    const list = pub.json() as Array<{ name: string; role: string }>
    expect(list.map((m) => m.name)).toEqual(['Alex Rivera', 'Abbey Road Studios'])
    expect(list[1]!.role).toBe('Mixing House')
  })

  it('rejects an empty name or role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/members',
      headers: { cookie },
      payload: { name: '  ', role: 'Guitar' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('edits and removes a member, and reorders the rest', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/me/channel/members',
      headers: { cookie },
    })
    const ids = (list.json() as Array<{ id: string }>).map((m) => m.id)

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/members/${ids[0]}`,
      headers: { cookie },
      payload: { role: 'Lead vocals' },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json().role).toBe('Lead vocals')

    const reordered = await app.inject({
      method: 'PUT',
      url: '/api/me/channel/members/reorder',
      headers: { cookie },
      payload: { ids: [ids[1], ids[0]] },
    })
    expect(reordered.statusCode).toBe(204)

    const afterReorder = await prisma.channelMember.findMany({
      where: { id: { in: ids as string[] } },
      orderBy: { position: 'asc' },
    })
    expect(afterReorder.map((m) => m.id)).toEqual([ids[1], ids[0]])

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/members/${ids[0]}`,
      headers: { cookie },
    })
    expect(deleted.statusCode).toBe(204)

    const remaining = await app.inject({
      method: 'GET',
      url: '/api/me/channel/members',
      headers: { cookie },
    })
    expect(remaining.json()).toHaveLength(1)
  })

  it("cannot edit or delete another artist's member", async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/api/me/channel/members',
      headers: { cookie },
    })
    const id = (list.json() as Array<{ id: string }>)[0]!.id

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/members/${id}`,
      headers: { cookie: otherCookie },
      payload: { name: 'Hijacked' },
    })
    expect(patch.statusCode).toBe(404)

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/members/${id}`,
      headers: { cookie: otherCookie },
    })
    expect(del.statusCode).toBe(404)
  })
})
