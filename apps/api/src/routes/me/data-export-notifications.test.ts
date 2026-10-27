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

const PREFIX = 'export-notifications-'

describe('GET /api/me/data-export.json — notifications', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    cookie = await sessionCookieFor(prisma, user.id)
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'NEW_FOLLOWER',
        actorUserId: fan.id,
        title: 'Someone followed you',
        url: `/u/${PREFIX}fan`,
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the notifications the account received, the actor by username', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().notifications).toEqual([
      expect.objectContaining({
        type: 'NEW_FOLLOWER',
        title: 'Someone followed you',
        readAt: null,
        actor: { username: `${PREFIX}fan` },
      }),
    ])
  })
})
