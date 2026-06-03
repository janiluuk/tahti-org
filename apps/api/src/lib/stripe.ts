// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

// Stripe integration boundary for fan-subscriptions (M19).
//
// Network calls to Stripe (Checkout session creation, Connect Express
// onboarding, transfers) require the official `stripe` SDK + live keys and are
// the remaining wiring step for production. Everything testable without the
// network lives here: webhook signature verification (real Stripe scheme) and
// the dev/test activation path used when Stripe is not configured.

export const stripeEnabled = config.stripe.enabled

export interface CheckoutSessionResult {
  id: string
  url: string
}

/** Create a one-time Stripe Checkout session (REST API, no SDK dependency). */
export async function createCheckoutSession(params: {
  customerEmail: string
  successUrl: string
  cancelUrl: string
  unitAmountCents: number
  productName: string
  metadata: Record<string, string>
}): Promise<CheckoutSessionResult> {
  const key = config.stripe.secretKey
  if (!key) throw new Error('Stripe is not configured')

  const body = new URLSearchParams({
    mode: 'payment',
    customer_email: params.customerEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(params.unitAmountCents),
    'line_items[0][price_data][product_data][name]': params.productName,
    'line_items[0][quantity]': '1',
  })
  for (const [k, v] of Object.entries(params.metadata)) {
    body.set(`metadata[${k}]`, v)
  }

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } }
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe Checkout failed (${res.status})`)
  }
  if (!data.id || !data.url) throw new Error('Stripe Checkout returned an incomplete session')
  return { id: data.id, url: data.url }
}

export interface StripeEvent {
  id?: string
  type: string
  data: { object: Record<string, unknown> }
}

// Verifies and parses a Stripe webhook payload. Implements Stripe's
// `t=<ts>,v1=<sig>` HMAC-SHA256 scheme over `${t}.${payload}`. When no webhook
// secret is configured (dev/test) the body is parsed without verification.
export function constructWebhookEvent(rawBody: string, signatureHeader?: string): StripeEvent {
  const secret = config.stripe.webhookSecret
  if (!secret) {
    return JSON.parse(rawBody) as StripeEvent
  }

  if (!signatureHeader) {
    throw new Error('Missing Stripe-Signature header')
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => {
      const [k, v] = kv.split('=')
      return [k.trim(), v]
    }),
  ) as { t?: string; v1?: string }

  if (!parts.t || !parts.v1) {
    throw new Error('Malformed Stripe-Signature header')
  }

  const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(parts.v1)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('Stripe signature verification failed')
  }

  return JSON.parse(rawBody) as StripeEvent
}
