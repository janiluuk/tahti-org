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

const PREFIX = 'group-notice-join-'
const slug = 'notice-join-crew'

describe('group join request notice', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}

  const noticesFor = (name: string) =>
    prisma.notification.findMany({
      where: { userId: ids[name]!, type: 'GROUP_JOIN_REQUESTED' },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['owner', 'admin', 'member', 'joiner']) {
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
      payload: { name: 'Notice Join Crew', slug, joinPolicy: 'REQUEST' },
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

  it('tells the owner and admins once, not members, linking to the Studio page', async () => {
    for (let i = 0; i < 2; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/me/groups/${slug}/join`,
        headers: { cookie: cookies.joiner! },
      })
      expect(res.statusCode).toBe(202)
    }
    const [owner, admin, member] = await Promise.all([
      noticesFor('owner'),
      noticesFor('admin'),
      noticesFor('member'),
    ])
    expect(owner).toHaveLength(1)
    expect(admin).toHaveLength(1)
    expect(member).toHaveLength(0)
    expect(owner[0]).toMatchObject({
      actorUserId: ids.joiner,
      url: `/studio/groups/${slug}`,
    })
    expect(owner[0]!.body).toContain('Notice Join Crew')
  })
})
