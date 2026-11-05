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

const PREFIX = 'group-members-remove-'
const slug = 'members-remove-crew'

describe('DELETE /api/me/groups/:slug/members/:username', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}
  let groupId = ''

  const remove = (who: string, username: string) =>
    app.inject({
      method: 'DELETE',
      url: `/api/me/groups/${slug}/members/${PREFIX}${username}`,
      headers: { cookie: cookies[who]! },
    })

  const roleOf = async (name: string) =>
    (
      await prisma.artistGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: ids[name]! } },
      })
    )?.role ?? null

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['owner', 'admin', 'admin2', 'member', 'member2', 'outsider']) {
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
      payload: { name: 'Members Remove Crew', slug },
    })
    expect(created.statusCode).toBe(201)
    groupId = (created.json() as { id: string }).id
    await prisma.artistGroupMember.createMany({
      data: [
        { groupId, userId: ids.admin!, role: 'ADMIN' },
        { groupId, userId: ids.admin2!, role: 'ADMIN' },
        { groupId, userId: ids.member!, role: 'MEMBER' },
        { groupId, userId: ids.member2!, role: 'MEMBER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lets an admin remove a member', async () => {
    const res = await remove('admin', 'member')
    expect(res.statusCode).toBe(204)
    expect(await roleOf('member')).toBeNull()
    const notice = await prisma.notification.findFirst({
      where: { userId: ids.member!, type: 'GROUP_MEMBER_REMOVED' },
    })
    expect(notice).toMatchObject({
      actorUserId: ids.admin,
      title: 'You were removed from Members Remove Crew',
      url: `/groups/${slug}`,
    })
  })

  it('does not let a member remove anyone', async () => {
    const res = await remove('member2', 'admin')
    expect(res.statusCode).toBe(403)
    expect(await roleOf('admin')).toBe('ADMIN')
  })

  it('keeps admins removable only by the owner', async () => {
    expect((await remove('admin', 'admin2')).statusCode).toBe(403)
    expect(await roleOf('admin2')).toBe('ADMIN')
    expect((await remove('owner', 'admin2')).statusCode).toBe(204)
    expect(await roleOf('admin2')).toBeNull()
  })

  it('never removes the owner, and sends people removing themselves to leave', async () => {
    expect((await remove('admin', 'owner')).statusCode).toBe(403)
    expect((await remove('admin', 'admin')).statusCode).toBe(409)
    expect(await roleOf('owner')).toBe('OWNER')
  })

  it('answers 404 for someone not in the group, and to outsiders', async () => {
    expect((await remove('owner', 'outsider')).statusCode).toBe(404)
    expect((await remove('outsider', 'member2')).statusCode).toBe(404)
    expect(await roleOf('member2')).toBe('MEMBER')
  })
})
