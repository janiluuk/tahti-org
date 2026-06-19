// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, sessionCookieFor } from '../../test/helpers.js'
import { hashPassword } from '../../lib/password.js'

const PREFIX = 'channel-provision-test-'

describe('self-service channel provisioning', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates a channel for a user that has none', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}nochannel@example.com`,
        passwordHash: await hashPassword('testpassword'),
        username: 'cp-no-channel',
        displayName: 'No Channel',
        emailVerifiedAt: new Date(),
      },
    })
    const cookie = await sessionCookieFor(prisma, user.id)

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/provision',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().slug).toBe('cp-no-channel')

    const channel = await prisma.channel.findUnique({ where: { userId: user.id } })
    expect(channel).not.toBeNull()
    expect(channel?.slug).toBe('cp-no-channel')
  })

  it('rejects with 409 when the user already has a channel', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}haschannel@example.com`,
        passwordHash: await hashPassword('testpassword'),
        username: 'cp-has-channel',
        displayName: 'Has Channel',
        emailVerifiedAt: new Date(),
        channel: {
          create: {
            slug: 'cp-has-channel',
            liveSourceMount: '/live/cp-has-channel',
            liveSourcePass: 'x',
            liveSourcePassHash: await hashPassword('x'),
            rtmpStreamKey: 'cp-has-channel__key',
            rtmpStreamKeyHash: await hashPassword('cp-has-channel__key'),
          },
        },
      },
    })
    const cookie = await sessionCookieFor(prisma, user.id)

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/provision',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(409)
  })

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/me/channel/provision' })
    expect(res.statusCode).toBe(401)
  })
})
