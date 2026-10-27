// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/email.js', () => ({
  sendAccountSuspendedEmail: vi.fn().mockResolvedValue(undefined),
  sendAccountReinstatedEmail: vi.fn().mockResolvedValue(undefined),
}))

import { sendAccountReinstatedEmail, sendAccountSuspendedEmail } from '../../lib/email.js'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'suspension-email-'

describe('Suspension and reinstatement are emailed', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
      displayName: 'Aino',
    })
    userId = user.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const post = (action: string, payload?: object) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/users/${userId}/${action}`,
      headers: { cookie: boardCookie },
      ...(payload ? { payload } : {}),
    })

  it('emails the reason once on suspension and the sign-in link on reinstatement', async () => {
    expect((await post('suspend', { reason: 'Spam uploads' })).statusCode).toBe(200)
    expect((await post('suspend', { reason: 'Spam uploads' })).statusCode).toBe(200)
    expect(sendAccountSuspendedEmail).toHaveBeenCalledTimes(1)
    expect(sendAccountSuspendedEmail).toHaveBeenCalledWith({
      to: `${PREFIX}user@example.com`,
      displayName: 'Aino',
      reason: 'Spam uploads',
    })

    expect((await post('unsuspend')).statusCode).toBe(200)
    expect((await post('unsuspend')).statusCode).toBe(200)
    expect(sendAccountReinstatedEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendAccountReinstatedEmail).mock.calls[0][0].signInUrl).toMatch(/\/login$/)
  })
})
