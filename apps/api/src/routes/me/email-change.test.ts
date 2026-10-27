// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../lib/email.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/email.js')>()),
  sendEmailChangeLink: vi.fn().mockResolvedValue(undefined),
}))

import { sendEmailChangeLink } from '../../lib/email.js'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'me-email-change-'

describe('POST /api/me/email', () => {
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
    await createTestArtist(prisma, {
      email: `${PREFIX}taken@example.com`,
      username: `${PREFIX}taken`,
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const ask = (payload: object) =>
    app.inject({ method: 'POST', url: '/api/me/email', headers: { cookie }, payload })

  it('refuses a wrong password, the same address and one in use', async () => {
    expect((await ask({ newEmail: `${PREFIX}new@example.com`, password: 'nope' })).statusCode).toBe(
      400,
    )
    expect(
      (await ask({ newEmail: `${PREFIX}user@example.com`, password: 'testpassword' })).statusCode,
    ).toBe(400)
    expect(
      (await ask({ newEmail: `${PREFIX}TAKEN@example.com`, password: 'testpassword' })).statusCode,
    ).toBe(409)
    expect(sendEmailChangeLink).not.toHaveBeenCalled()
  })

  it('sends a link to the new address and keeps the old one until it is opened', async () => {
    const res = await ask({ newEmail: `${PREFIX}New@Example.com`, password: 'testpassword' })
    expect(res.statusCode).toBe(200)
    const pending = await prisma.emailChange.findMany({ where: { userId } })
    expect(pending).toHaveLength(1)
    expect(pending[0]!.newEmail).toBe(`${PREFIX}new@example.com`)
    expect(sendEmailChangeLink).toHaveBeenCalledWith(
      expect.objectContaining({
        to: `${PREFIX}new@example.com`,
        confirmUrl: expect.stringMatching(
          new RegExp(`/email-change\\?token=${pending[0]!.token}$`),
        ),
      }),
    )
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    expect(user.email).toBe(`${PREFIX}user@example.com`)

    await ask({ newEmail: `${PREFIX}other@example.com`, password: 'testpassword' })
    expect(await prisma.emailChange.count({ where: { userId } })).toBe(1)
  })
})
