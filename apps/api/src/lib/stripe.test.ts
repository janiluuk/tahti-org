// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('stripe REST helpers', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url).replace('https://api.stripe.com/v1', '')
        if (path === '/accounts' && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              id: 'acct_test',
              charges_enabled: false,
              details_submitted: false,
            }),
            { status: 200 },
          )
        }
        if (path === '/accounts/acct_test') {
          return new Response(
            JSON.stringify({
              id: 'acct_test',
              charges_enabled: true,
              details_submitted: true,
            }),
            { status: 200 },
          )
        }
        if (path === '/checkout/sessions' && init?.method === 'POST') {
          const body = new URLSearchParams(init.body as string)
          expect(body.get('mode')).toBe('subscription')
          expect(body.get('subscription_data[transfer_data][destination]')).toBe('acct_dest')
          expect(body.get('subscription_data[application_fee_percent]')).toBe('2')
          return new Response(
            JSON.stringify({ id: 'cs_test', url: 'https://checkout.stripe.com/test' }),
            { status: 200 },
          )
        }
        return new Response(JSON.stringify({ error: { message: 'unexpected' } }), { status: 400 })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = originalKey
  })

  it('creates a Connect Express account', async () => {
    const { createConnectExpressAccount } = await import('./stripe.js')
    const account = await createConnectExpressAccount({
      email: 'artist@example.com',
      userId: 'user_1',
    })
    expect(account.id).toBe('acct_test')
    expect(account.chargesEnabled).toBe(false)
  })

  it('fetches Connect account charges_enabled', async () => {
    const { fetchConnectAccount } = await import('./stripe.js')
    const account = await fetchConnectAccount('acct_test')
    expect(account.chargesEnabled).toBe(true)
    expect(account.detailsSubmitted).toBe(true)
  })

  it('creates fan-sub Checkout with destination + 2% fee', async () => {
    const { createFanSubCheckoutSession } = await import('./stripe.js')
    const session = await createFanSubCheckoutSession({
      customerId: 'cus_test',
      connectedAccountId: 'acct_dest',
      successUrl: 'http://localhost/success',
      cancelUrl: 'http://localhost/cancel',
      tierName: 'Backer',
      amountCents: 500,
      metadata: {
        artistUserId: 'a1',
        subscriberUserId: 's1',
        tierName: 'Backer',
        amountCents: '500',
      },
    })
    expect(session.url).toContain('checkout.stripe.com')
    expect(session.id).toBe('cs_test')
  })
})
