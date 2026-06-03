// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('../../config.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../config.js')>()
  return {
    config: {
      ...mod.config,
      stripe: {
        secretKey: 'sk_test_connect_suite',
        webhookSecret: '',
        enabled: true,
      },
    },
  }
})

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'

const PREFIX = 'fansub-stripe-'

describe('M19 — Stripe Connect (production config)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistCookie: string
  let fanCookie: string
  let tierId: string
  let artistId: string

  beforeAll(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url).replace('https://api.stripe.com/v1', '')
        if (path === '/accounts' && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              id: 'acct_stripe_suite',
              charges_enabled: false,
              details_submitted: false,
            }),
            { status: 200 },
          )
        }
        if (path === '/account_links' && init?.method === 'POST') {
          return new Response(JSON.stringify({ url: 'https://connect.stripe.com/setup/test' }), {
            status: 200,
          })
        }
        if (path.startsWith('/accounts/')) {
          return new Response(
            JSON.stringify({
              id: 'acct_stripe_suite',
              charges_enabled: true,
              details_submitted: true,
            }),
            { status: 200 },
          )
        }
        if (path === '/customers' && init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 'cus_fan_test' }), { status: 200 })
        }
        if (path === '/checkout/sessions' && init?.method === 'POST') {
          return new Response(
            JSON.stringify({ id: 'cs_fan', url: 'https://checkout.stripe.com/fan' }),
            { status: 200 },
          )
        }
        return new Response(JSON.stringify({ error: { message: 'unexpected' } }), { status: 400 })
      }),
    )

    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    const artist = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash,
        username: 'fansub-stripe-artist',
        displayName: 'Stripe Artist',
        emailVerifiedAt: new Date(),
        stripeConnectAccountId: 'acct_stripe_suite',
        stripeConnectChargesEnabled: false,
        channel: {
          create: {
            slug: 'fansub-stripe-artist',
            liveSourceMount: '/live/x',
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: 'x',
            rtmpStreamKeyHash: 'x',
          },
        },
      },
    })
    artistId = artist.id
    artistCookie = `tahti_session=${(await createSession(prisma, artist.id)).id}`

    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash,
        username: 'fansub-stripe-fan',
        displayName: 'Fan',
        emailVerifiedAt: new Date(),
      },
    })
    fanCookie = `tahti_session=${(await createSession(prisma, fan.id)).id}`

    tierId = (
      await prisma.fanTier.create({
        data: {
          artistUserId: artistId,
          name: 'Backer',
          amountCents: 500,
          position: 0,
          active: true,
        },
      })
    ).id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
    vi.unstubAllGlobals()
  })

  it('exposes paymentsReady=false until charges_enabled', async () => {
    const tiers = await app.inject({ method: 'GET', url: '/api/v1/u/fansub-stripe-artist/tiers' })
    expect(tiers.json().paymentsReady).toBe(false)

    const sub = await app.inject({
      method: 'POST',
      url: '/api/v1/u/fansub-stripe-artist/subscribe',
      headers: { cookie: fanCookie },
      payload: { tierId },
    })
    expect(sub.statusCode).toBe(503)
  })

  it('returns checkout URL after Connect status sync shows charges enabled', async () => {
    const status = await app.inject({
      method: 'GET',
      url: '/api/me/fan-subs/connect',
      headers: { cookie: artistCookie },
    })
    expect(status.json().paymentsReady).toBe(true)

    const sub = await app.inject({
      method: 'POST',
      url: '/api/v1/u/fansub-stripe-artist/subscribe',
      headers: { cookie: fanCookie },
      payload: { tierId },
    })
    expect(sub.statusCode).toBe(200)
    expect(sub.json().checkoutUrl).toContain('checkout.stripe.com')
  })

  it('POST onboard creates account when missing', async () => {
    await prisma.user.update({
      where: { id: artistId },
      data: { stripeConnectAccountId: null },
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/fan-subs/connect/onboard',
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().onboardingUrl).toContain('stripe.com')

    const user = await prisma.user.findUnique({ where: { id: artistId } })
    expect(user?.stripeConnectAccountId).toBe('acct_stripe_suite')
  })
})
