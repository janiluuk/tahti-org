// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/security-email.js', () => ({
  sendSecurityNotice: vi.fn().mockResolvedValue(undefined),
}))

import { sendSecurityNotice } from '../../lib/security-email.js'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'api-token-created-email-'

describe('Creating an API token is emailed', () => {
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

  it('names the token but never includes it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/api-tokens',
      headers: { cookie },
      payload: { name: 'CLI' },
    })
    expect(res.statusCode).toBe(201)
    const call = vi.mocked(sendSecurityNotice).mock.calls[0]![0]
    expect(call.subject).toBe('A new API token was created on your Tahti account')
    expect(call.what).toContain('"CLI"')
    expect(call.what).not.toContain(res.json().token)
  })
})
