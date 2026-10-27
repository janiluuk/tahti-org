// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'login-suspended-'

describe('Signing in to a suspended account', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    await prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: new Date(), suspendReason: 'Spam uploads' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const login = (password: string) =>
    app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `${PREFIX}user@example.com`, password },
    })

  it('gives the reason once the password is right', async () => {
    const res = await login('testpassword')
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe(
      'This account has been suspended. Reason: Spam uploads. Write to support@tahti.live if you think this is a mistake.',
    )
  })

  it('says nothing about the account for a wrong password', async () => {
    const res = await login('wrongpassword')
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('Invalid email or password')
  })
})
