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

const PREFIX = 'export-email-changes-'

describe('GET /api/me/data-export.json — email change requests', () => {
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
    await prisma.emailChange.create({
      data: {
        userId: user.id,
        newEmail: `${PREFIX}new@example.com`,
        token: `${PREFIX}secret-token`,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the requests without their tokens', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().emailChanges).toEqual([
      expect.objectContaining({ newEmail: `${PREFIX}new@example.com`, usedAt: null }),
    ])
    expect(res.body).not.toContain(`${PREFIX}secret-token`)
  })
})
