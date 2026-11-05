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

const PREFIX = 'group-notice-answer-'
const slug = 'notice-answer-crew'

describe('group join answer notice', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}

  const requestAndResolve = async (name: string, action: 'APPROVE' | 'REJECT') => {
    const asked = await app.inject({
      method: 'POST',
      url: `/api/me/groups/${slug}/join`,
      headers: { cookie: cookies[name]! },
    })
    expect(asked.statusCode).toBe(202)
    const { requestId } = asked.json() as { requestId: string }
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/groups/${slug}/join-requests/${requestId}/resolve`,
      headers: { cookie: cookies.owner! },
      payload: { action },
    })
    expect(res.statusCode).toBe(200)
    return prisma.notification.findMany({
      where: { userId: ids[name]!, type: 'GROUP_JOIN_RESOLVED' },
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['owner', 'yes', 'no']) {
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
      payload: { name: 'Notice Answer Crew', slug, joinPolicy: 'REQUEST' },
    })
    expect(created.statusCode).toBe(201)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('tells an approved requester they joined', async () => {
    const notices = await requestAndResolve('yes', 'APPROVE')
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      actorUserId: ids.owner,
      title: 'You joined Notice Answer Crew',
      url: `/groups/${slug}`,
    })
  })

  it('tells a declined requester too', async () => {
    const notices = await requestAndResolve('no', 'REJECT')
    expect(notices).toHaveLength(1)
    expect(notices[0]!.title).toBe('Your request to join was declined')
  })
})
