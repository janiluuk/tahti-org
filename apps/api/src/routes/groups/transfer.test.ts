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

const PREFIX = 'group-transfer-'
const slug = 'transfer-crew'

describe('POST /api/me/groups/:slug/transfer', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}
  let groupId = ''

  const transfer = (who: string, username: string) =>
    app.inject({
      method: 'POST',
      url: `/api/me/groups/${slug}/transfer`,
      headers: { cookie: cookies[who]! },
      payload: { username: `${PREFIX}${username}` },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['owner', 'heir', 'blocked', 'outsider']) {
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
      payload: { name: 'Transfer Crew', slug },
    })
    expect(created.statusCode).toBe(201)
    groupId = (created.json() as { id: string }).id
    await prisma.artistGroupMember.createMany({
      data: [
        { groupId, userId: ids.heir!, role: 'MEMBER' },
        { groupId, userId: ids.blocked!, role: 'MEMBER' },
      ],
    })
    await prisma.userBlock.create({
      data: { blockerUserId: ids.blocked!, blockedUserId: ids.owner! },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('refuses outsiders, non-owners, non-members, a block and yourself', async () => {
    expect((await transfer('outsider', 'heir')).statusCode).toBe(404)
    expect((await transfer('heir', 'heir')).statusCode).toBe(403)
    expect((await transfer('owner', 'outsider')).statusCode).toBe(404)
    expect((await transfer('owner', 'blocked')).statusCode).toBe(409)
    expect((await transfer('owner', 'owner')).statusCode).toBe(409)
  })

  it('makes the member the owner, keeps the old owner as admin, and moves the playlist', async () => {
    const res = await transfer('owner', 'heir')
    expect(res.statusCode).toBe(200)
    const members = await prisma.artistGroupMember.findMany({
      where: { groupId },
      select: { userId: true, role: true },
    })
    const role = (id: string) => members.find((m) => m.userId === id)?.role
    expect(role(ids.heir!)).toBe('OWNER')
    expect(role(ids.owner!)).toBe('ADMIN')
    const group = await prisma.artistGroup.findUniqueOrThrow({
      where: { id: groupId },
      select: { createdByUserId: true, collection: { select: { userId: true } } },
    })
    expect(group.createdByUserId).toBe(ids.heir)
    expect(group.collection.userId).toBe(ids.heir)
    expect((await transfer('owner', 'heir')).statusCode).toBe(403)
  })
})
