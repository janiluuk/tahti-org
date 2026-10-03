// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('../../config.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../config.js')>()
  return {
    config: {
      ...mod.config,
      stripe: {
        secretKey: 'sk_test_cancel_suite',
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

const PREFIX = 'fansub-cancel-'
const DAY_MS = 24 * 60 * 60 * 1000

type StripeCall = { path: string; method: string; body: string }

describe('Fan-sub cancel with Stripe configured', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let fanCookie: string
  let fanId: string
  let artistId: string
  let tierId: string
  let stripeCalls: StripeCall[]
  let stripeSubscriptionFails: boolean

  async function resetSubscription(state: 'ACTIVE' | 'CANCELED', stripeSubscriptionId: string) {
    await prisma.fanSubscription.deleteMany({ where: { subscriberUserId: fanId } })
    return prisma.fanSubscription.create({
      data: {
        artistUserId: artistId,
        subscriberUserId: fanId,
        tierName: 'Backer',
        amountCents: 500,
        stripeSubscriptionId,
        state,
        canceledAt: state === 'CANCELED' ? new Date() : null,
        currentPeriodEnd: new Date(Date.now() + 20 * DAY_MS),
      },
    })
  }

  beforeAll(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url).replace('https://api.stripe.com/v1', '')
        const method = init?.method ?? 'GET'
        stripeCalls.push({ path, method, body: String(init?.body ?? '') })
        if (path.startsWith('/subscriptions/') && method === 'POST') {
          if (stripeSubscriptionFails) {
            return new Response(JSON.stringify({ error: { message: 'Stripe is down' } }), {
              status: 500,
            })
          }
          return new Response(JSON.stringify({ id: path.split('/')[2] }), { status: 200 })
        }
        if (path === '/billing_portal/sessions' && method === 'POST') {
          return new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/fan' }), {
            status: 200,
          })
        }
        if (path === '/checkout/sessions' && method === 'POST') {
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
        username: 'fansub-cancel-artist',
        displayName: 'Cancel Artist',
        emailVerifiedAt: new Date(),
        stripeConnectAccountId: 'acct_cancel_suite',
        stripeConnectChargesEnabled: true,
      },
    })
    artistId = artist.id

    const fan = await prisma.user.create({
      data: {
        email: `${PREFIX}fan@example.com`,
        passwordHash,
        username: 'fansub-cancel-fan',
        displayName: 'Fan',
        emailVerifiedAt: new Date(),
        stripeCustomerId: 'cus_cancel_fan',
      },
    })
    fanId = fan.id
    fanCookie = `tahti_session=${(await createSession(prisma, fan.id)).id}`

    tierId = (
      await prisma.fanTier.create({
        data: { artistUserId: artistId, name: 'Backer', amountCents: 500, position: 0 },
      })
    ).id
  })

  beforeEach(() => {
    stripeCalls = []
    stripeSubscriptionFails = false
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
    vi.unstubAllGlobals()
  })

  it('stops renewal on the Stripe subscription before marking it canceled', async () => {
    const sub = await resetSubscription('ACTIVE', 'sub_cancel_ok')

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/subscriptions/${sub.id}/cancel`,
      headers: { cookie: fanCookie },
    })

    expect(res.statusCode).toBe(200)
    expect(stripeCalls).toEqual([
      { path: '/subscriptions/sub_cancel_ok', method: 'POST', body: 'cancel_at_period_end=true' },
    ])
    const row = await prisma.fanSubscription.findUnique({ where: { id: sub.id } })
    expect(row?.state).toBe('CANCELED')
    expect(row?.canceledAt).not.toBeNull()
  })

  it('returns 502 and leaves the subscription active when Stripe fails', async () => {
    const sub = await resetSubscription('ACTIVE', 'sub_cancel_fail')
    stripeSubscriptionFails = true

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/subscriptions/${sub.id}/cancel`,
      headers: { cookie: fanCookie },
    })

    expect(res.statusCode).toBe(502)
    const row = await prisma.fanSubscription.findUnique({ where: { id: sub.id } })
    expect(row?.state).toBe('ACTIVE')
    expect(row?.canceledAt).toBeNull()
  })

  it('does not call Stripe for a dev-stub subscription', async () => {
    const sub = await resetSubscription('ACTIVE', `dev_${artistId}_${fanId}`)

    const res = await app.inject({
      method: 'POST',
      url: `/api/me/subscriptions/${sub.id}/cancel`,
      headers: { cookie: fanCookie },
    })

    expect(res.statusCode).toBe(200)
    expect(stripeCalls).toEqual([])
  })

  it('refuses a new checkout while a canceled subscription is still in its paid period', async () => {
    await resetSubscription('CANCELED', 'sub_still_running')

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/u/fansub-cancel-artist/subscribe',
      headers: { cookie: fanCookie },
      payload: { tierId },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toContain('billing portal')
    expect(stripeCalls.some((c) => c.path === '/checkout/sessions')).toBe(false)
  })

  it('opens the billing portal for a canceled subscription so the fan can resume it', async () => {
    await resetSubscription('CANCELED', 'sub_resume_in_portal')

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/fansubs/portal',
      headers: { cookie: fanCookie },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().portalUrl).toContain('billing.stripe.com')
  })
})
