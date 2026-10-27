// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../server.js'
import { prisma } from '@tahti/db'
import { generateApiToken } from '../lib/api-token.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

const PREFIX = 'auth-suspended-message-'

describe('A suspended account calling the API with a token', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let token: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    const generated = generateApiToken()
    token = generated.token
    await prisma.apiToken.create({
      data: {
        userId: user.id,
        name: 'CLI',
        tokenHash: generated.tokenHash,
        tokenPrefix: generated.tokenPrefix,
      },
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

  it('is told why, like at sign-in', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/restrictions',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe(
      'This account has been suspended. Reason: Spam uploads. Write to support@tahti.live if you think this is a mistake.',
    )
  })
})
