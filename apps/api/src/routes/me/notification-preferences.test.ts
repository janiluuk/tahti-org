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

const PREFIX = 'notification-prefs-'

describe('/api/me/notification-preferences', () => {
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
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('reads and turns off Studio job notices', async () => {
    const before = await app.inject({
      method: 'GET',
      url: '/api/me/notification-preferences',
      headers: { cookie },
    })
    expect(before.json().notifyStudioJobsInApp).toBe(true)
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/notification-preferences',
      headers: { cookie },
      payload: { notifyStudioJobsInApp: false },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().notifyStudioJobsInApp).toBe(false)
  })
})
