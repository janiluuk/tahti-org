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

const PREFIX = 'group-notice-deleted-'
const slug = 'notice-deleted-crew'

describe('group deleted notice', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}

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
      payload: { name: 'Notice Deleted Crew', slug },
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

  it('tells every member but the owner, and nobody outside', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/me/groups/${slug}`,
      headers: { cookie: cookies.owner! },
    })
    expect(res.statusCode).toBe(204)
    const notices = await prisma.notification.findMany({
      where: { type: 'GROUP_DELETED', actorUserId: ids.owner },
      select: { userId: true, title: true, url: true },
    })
    expect(notices.map((n) => n.userId).sort()).toEqual([ids.admin, ids.member].sort())
    expect(notices[0]).toMatchObject({ title: 'Notice Deleted Crew was deleted', url: '/groups' })
  })
})
