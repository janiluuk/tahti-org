// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'group-notice-submit-'
const slug = 'notice-submit-crew'

describe('group submission notice', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const cookies: Record<string, string> = {}
  const ids: Record<string, string> = {}
  let soundId = ''

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['owner', 'admin', 'member']) {
      const user = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
      })
      ids[name] = user.id
      cookies[name] = await sessionCookieFor(prisma, user.id)
      if (name === 'member') {
        soundId = (await createReadySound(prisma, user.channel!.id, 'Waiting Room')).id
      }
    }
    const created = await app.inject({
      method: 'POST',
      url: '/api/me/groups',
      headers: { cookie: cookies.owner! },
      payload: { name: 'Notice Submit Crew', slug, submitPolicy: 'APPROVE' },
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

  it('tells the owner and admins about a track waiting for approval', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/me/groups/${slug}/sounds`,
      headers: { cookie: cookies.member! },
      payload: { soundId },
    })
    expect(res.statusCode).toBe(202)
    const notices = await prisma.notification.findMany({
      where: { type: 'GROUP_SUBMISSION_RECEIVED', actorUserId: ids.member },
      select: { userId: true, body: true, url: true },
    })
    expect(notices.map((n) => n.userId).sort()).toEqual([ids.admin, ids.owner].sort())
    expect(notices[0]).toMatchObject({
      body: '"Waiting Room" was submitted to Notice Submit Crew.',
      url: `/studio/groups/${slug}`,
    })
  })
})
