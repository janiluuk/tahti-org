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

const PREFIX = 'pending-email-change-'

describe('GET and DELETE /api/me/email', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    userId = user.id
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const read = async () =>
    (await app.inject({ method: 'GET', url: '/api/me/email', headers: { cookie } })).json()

  it('reports the pending change and cancels it', async () => {
    expect(await read()).toEqual({ pending: null })
    const expiresAt = new Date(Date.now() + 3600_000)
    await prisma.emailChange.create({
      data: { userId, newEmail: `${PREFIX}new@example.com`, token: `${PREFIX}t`, expiresAt },
    })
    expect(await read()).toEqual({
      pending: { newEmail: `${PREFIX}new@example.com`, expiresAt: expiresAt.toISOString() },
    })

    const cancel = await app.inject({ method: 'DELETE', url: '/api/me/email', headers: { cookie } })
    expect(cancel.statusCode).toBe(204)
    expect(await read()).toEqual({ pending: null })
    const confirm = await app.inject({
      method: 'POST',
      url: '/api/auth/email-change/confirm',
      payload: { token: `${PREFIX}t` },
    })
    expect(confirm.statusCode).toBe(400)
  })
})
