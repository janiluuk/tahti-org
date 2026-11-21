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

const PREFIX = 'export-linked-accounts-'

describe('GET /api/me/data-export.json — linked sign-in accounts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let linkedAt: Date

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    cookie = await sessionCookieFor(prisma, user.id)
    const row = await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: 'google',
        providerUserId: `${PREFIX}google-sub`,
        email: `${PREFIX}google@example.com`,
      },
    })
    linkedAt = row.createdAt
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists provider, email and link time only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().linkedAccounts).toEqual([
      {
        provider: 'google',
        email: `${PREFIX}google@example.com`,
        linkedAt: linkedAt.toISOString(),
      },
    ])
  })
})
