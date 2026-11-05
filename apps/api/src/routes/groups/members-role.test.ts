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

const PREFIX = 'group-members-role-'
const slug = 'members-role-crew'

describe('PATCH /api/me/groups/:slug/members/:username', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}

  const setRole = (who: string, username: string, role: string) =>
    app.inject({
      method: 'PATCH',
      url: `/api/me/groups/${slug}/members/${PREFIX}${username}`,
      headers: { cookie: cookies[who]! },
      payload: { role },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['owner', 'admin', 'member', 'outsider']) {
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
      payload: { name: 'Members Role Crew', slug },
    })
    expect(created.statusCode).toBe(201)
    const groupId = (created.json() as { id: string }).id
    await prisma.artistGroupMember.createMany({
      data: [
        { groupId, userId: ids.admin!, role: 'ADMIN' },
        { groupId, userId: ids.member!, role: 'MEMBER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lets the owner promote a member and demote them again', async () => {
    const up = await setRole('owner', 'member', 'ADMIN')
    expect(up.statusCode).toBe(200)
    expect(up.json()).toMatchObject({ username: `${PREFIX}member`, role: 'ADMIN' })
    const down = await setRole('owner', 'member', 'MEMBER')
    expect(down.json()).toMatchObject({ role: 'MEMBER' })
    const notices = await prisma.notification.findMany({
      where: { userId: ids.member!, type: 'GROUP_ROLE_CHANGED' },
      orderBy: { createdAt: 'asc' },
      select: { title: true },
    })
    expect(notices.map((n) => n.title)).toEqual([
      'You are now an admin of Members Role Crew',
      'You are no longer an admin of Members Role Crew',
    ])
  })

  it('sends nothing when the role does not change', async () => {
    const before = await prisma.notification.count({ where: { userId: ids.admin! } })
    expect((await setRole('owner', 'admin', 'ADMIN')).statusCode).toBe(200)
    expect(await prisma.notification.count({ where: { userId: ids.admin! } })).toBe(before)
  })

  it('keeps role changes to the owner', async () => {
    expect((await setRole('admin', 'member', 'ADMIN')).statusCode).toBe(403)
    expect((await setRole('outsider', 'member', 'ADMIN')).statusCode).toBe(404)
  })

  it('does not change the owner through this route, and rejects other roles', async () => {
    expect((await setRole('owner', 'owner', 'MEMBER')).statusCode).toBe(409)
    expect((await setRole('owner', 'member', 'OWNER')).statusCode).toBe(400)
    expect((await setRole('owner', 'outsider', 'ADMIN')).statusCode).toBe(404)
  })
})
