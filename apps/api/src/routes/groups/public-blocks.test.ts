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

const PREFIX = 'group-public-blocks-'
const slug = 'public-blocks-crew'

describe('public groups and blocks with the founder', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}

  const listed = async (who?: string) => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/groups?q=Public%20Blocks',
      headers: who ? { cookie: cookies[who]! } : {},
    })
    expect(res.statusCode).toBe(200)
    return (res.json() as { items: Array<{ slug: string }> }).items.map((g) => g.slug)
  }
  const detail = (who?: string) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/groups/${slug}`,
      headers: who ? { cookie: cookies[who]! } : {},
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['founder', 'blocked', 'blocker', 'fan']) {
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
      headers: { cookie: cookies.founder! },
      payload: { name: 'Public Blocks Crew', slug },
    })
    expect(created.statusCode).toBe(201)
    await prisma.userBlock.createMany({
      data: [
        { blockerUserId: ids.founder!, blockedUserId: ids.blocked! },
        { blockerUserId: ids.blocker!, blockedUserId: ids.founder! },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists and shows the group to everyone else', async () => {
    expect(await listed()).toEqual([slug])
    expect(await listed('fan')).toEqual([slug])
    expect((await detail()).statusCode).toBe(200)
    expect((await detail('fan')).statusCode).toBe(200)
  })

  it('hides the group from someone the founder blocked, and from someone who blocked them', async () => {
    expect(await listed('blocked')).toEqual([])
    expect(await listed('blocker')).toEqual([])
    expect((await detail('blocked')).statusCode).toBe(404)
    expect((await detail('blocker')).statusCode).toBe(404)
  })
})
