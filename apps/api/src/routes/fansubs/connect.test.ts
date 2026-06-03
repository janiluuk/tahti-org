// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'fansub-connect-'

describe('M19 — Stripe Connect status (dev / no Stripe key)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash,
        username: 'fansub-connect-artist',
        displayName: 'Connect Artist',
        emailVerifiedAt: new Date(),
        channel: {
          create: {
            slug: 'fansub-connect-artist',
            liveSourceMount: '/live/x',
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: 'x',
            rtmpStreamKeyHash: 'x',
          },
        },
      },
    })
    cookie = `tahti_session=${(await createSession(prisma, user.id)).id}`
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('returns paymentsReady when Stripe is not configured', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/fan-subs/connect',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().paymentsReady).toBe(true)
    expect(res.json().stripeConfigured).toBe(false)
  })

  it('rejects onboard when Stripe is not configured', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/fan-subs/connect/onboard',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('not configured')
  })
})
