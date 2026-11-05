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

const PREFIX = 'group-members-list-'

describe('GET /api/me/groups/:slug/members', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}
  const slug = 'members-list-crew'

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['owner', 'early', 'late', 'outsider', 'gone']) {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
      })
      ids[name] = user.id
      cookies[name] = await sessionCookieFor(prisma, user.id)
    }
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/groups',
      headers: { cookie: cookies.owner! },
      payload: { name: 'Members List Crew', slug },
    })
    expect(created.statusCode).toBe(201)
    for (const name of ['early', 'late', 'gone']) {
      const joined = await app.inject({
        method: 'POST',
        url: `/api/me/groups/${slug}/join`,
        headers: { cookie: cookies[name]! },
      })
      expect(joined.statusCode).toBe(201)
    }
    const group = await prisma.artistGroup.findUniqueOrThrow({ where: { slug } })
    await prisma.artistGroupMember.update({
      where: { groupId_userId: { groupId: group.id, userId: ids.late! } },
      data: { role: 'ADMIN' },
    })
    await prisma.user.update({ where: { id: ids.gone }, data: { suspendedAt: new Date() } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists every available member, owner and admins first', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/groups/${slug}/members`,
      headers: { cookie: cookies.early! },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ username: string; role: string }>; total: number }
    expect(body.total).toBe(3)
    expect(body.items.map((m) => [m.username, m.role])).toEqual([
      [`${PREFIX}owner`, 'OWNER'],
      [`${PREFIX}late`, 'ADMIN'],
      [`${PREFIX}early`, 'MEMBER'],
    ])
    expect(body.items[0]).toHaveProperty('joinedAt')
    expect(body.items[0]).toHaveProperty('avatarUrl')
  })

  it('reads as missing to someone outside the group', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/groups/${slug}/members`,
      headers: { cookie: cookies.outsider! },
    })
    expect(res.statusCode).toBe(404)
  })

  it('needs a session', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/me/groups/${slug}/members` })
    expect(res.statusCode).toBe(401)
  })
})
