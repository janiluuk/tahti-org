// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

// Stripe integration for membership (M1) and fan-subscriptions (M19).
// Uses the Stripe REST API directly — no SDK dependency — so unit tests can
// mock `fetch` and dev/test runs without network when STRIPE_SECRET_KEY is unset.

export const stripeEnabled = config.stripe.enabled

const STRIPE_API = 'https://api.stripe.com/v1'
const ORG_FEE_PERCENT = 2 // 2% operational fee on fan-sub gross (bylaws §11.b)

export interface CheckoutSessionResult {
  id: string
  url: string
}

export interface StripeAccountSnapshot {
  id: string
  chargesEnabled: boolean
  detailsSubmitted: boolean
}

type StripeErrorBody = { error?: { message?: string } }

async function stripePost(path: string, params: Record<string, string>): Promise<unknown> {
  const key = config.stripe.secretKey
  if (!key) throw new Error('Stripe is not configured')

  const body = new URLSearchParams(params)
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = (await res.json()) as StripeErrorBody & Record<string, unknown>
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe API ${path} failed (${res.status})`)
  }
  return data
}

async function stripeGet(path: string): Promise<unknown> {
  const key = config.stripe.secretKey
  if (!key) throw new Error('Stripe is not configured')

  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  })

  const data = (await res.json()) as StripeErrorBody & Record<string, unknown>
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe API ${path} failed (${res.status})`)
  }
  return data
}

function accountSnapshot(raw: Record<string, unknown>): StripeAccountSnapshot {
  return {
    id: String(raw.id),
    chargesEnabled: raw.charges_enabled === true,
    detailsSubmitted: raw.details_submitted === true,
  }
}

/** Create a one-time Stripe Checkout session (legacy dev / fallback). */
export async function createCheckoutSession(params: {
  customerEmail: string
  successUrl: string
  cancelUrl: string
  unitAmountCents: number
  productName: string
  metadata: Record<string, string>
}): Promise<CheckoutSessionResult> {
  const fields: Record<string, string> = {
    mode: 'payment',
    customer_email: params.customerEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(params.unitAmountCents),
    'line_items[0][price_data][product_data][name]': params.productName,
    'line_items[0][quantity]': '1',
  }
  for (const [k, v] of Object.entries(params.metadata)) {
    fields[`metadata[${k}]`] = v
  }

  const data = (await stripePost('/checkout/sessions', fields)) as {
    id?: string
    url?: string
  }
  if (!data.id || !data.url) throw new Error('Stripe Checkout returned an incomplete session')
  return { id: data.id, url: data.url }
}

/** Annual membership Checkout — Stripe subscription (yearly renewal + invoice.paid ledger). */
export async function createMembershipCheckoutSession(params: {
  customerEmail?: string
  customerId?: string
  successUrl: string
  cancelUrl: string
  unitAmountCents: number
  productName: string
  metadata: Record<string, string>
}): Promise<CheckoutSessionResult> {
  const fields: Record<string, string> = {
    mode: 'subscription',
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(params.unitAmountCents),
    'line_items[0][price_data][recurring][interval]': 'year',
    'line_items[0][price_data][product_data][name]': params.productName,
    'line_items[0][quantity]': '1',
  }
  if (params.customerId) {
    fields.customer = params.customerId
  } else if (params.customerEmail) {
    fields.customer_email = params.customerEmail
  }
  for (const [k, v] of Object.entries(params.metadata)) {
    fields[`metadata[${k}]`] = v
    fields[`subscription_data[metadata][${k}]`] = v
  }

  const data = (await stripePost('/checkout/sessions', fields)) as {
    id?: string
    url?: string
  }
  if (!data.id || !data.url) throw new Error('Stripe Checkout returned an incomplete session')
  return { id: data.id, url: data.url }
}

/** Create a Stripe Customer for a listener (fan-subscriber). */
export async function createStripeCustomer(params: {
  email: string
  userId: string
}): Promise<string> {
  const data = (await stripePost('/customers', {
    email: params.email,
    'metadata[userId]': params.userId,
  })) as { id?: string }
  if (!data.id) throw new Error('Stripe Customer creation returned no id')
  return data.id
}

/** Create a Stripe Connect Express account for an artist. */
export async function createConnectExpressAccount(params: {
  email: string
  userId: string
}): Promise<StripeAccountSnapshot> {
  const data = (await stripePost('/accounts', {
    type: 'express',
    email: params.email,
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
    'metadata[userId]': params.userId,
  })) as Record<string, unknown>
  return accountSnapshot(data)
}

/** Fetch the latest Connect account state from Stripe. */
export async function fetchConnectAccount(accountId: string): Promise<StripeAccountSnapshot> {
  const data = (await stripeGet(`/accounts/${encodeURIComponent(accountId)}`)) as Record<
    string,
    unknown
  >
  return accountSnapshot(data)
}

/** Start or resume Stripe Connect Express onboarding. */
export async function createConnectAccountLink(params: {
  accountId: string
  refreshUrl: string
  returnUrl: string
}): Promise<string> {
  const data = (await stripePost('/account_links', {
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: 'account_onboarding',
  })) as { url?: string }
  if (!data.url) throw new Error('Stripe Account Link returned no url')
  return data.url
}

/** Stripe Customer Portal for membership billing history and payment method. */
export async function createBillingPortalSession(params: {
  customerId: string
  returnUrl: string
}): Promise<{ url: string }> {
  const data = (await stripePost('/billing_portal/sessions', {
    customer: params.customerId,
    return_url: params.returnUrl,
  })) as { url?: string }
  if (!data.url) throw new Error('Stripe Billing Portal returned no url')
  return { url: data.url }
}

/** Fan-subscription Checkout — destination charge with 2% application fee. */
export async function createFanSubCheckoutSession(params: {
  customerId: string
  connectedAccountId: string
  successUrl: string
  cancelUrl: string
  tierName: string
  amountCents: number
  metadata: Record<string, string>
}): Promise<CheckoutSessionResult> {
  const productName = `${params.tierName} — fan subscription`
  const fields: Record<string, string> = {
    mode: 'subscription',
    customer: params.customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(params.amountCents),
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][product_data][name]': productName,
    'line_items[0][quantity]': '1',
    'subscription_data[transfer_data][destination]': params.connectedAccountId,
    'subscription_data[application_fee_percent]': String(ORG_FEE_PERCENT),
  }
  for (const [k, v] of Object.entries(params.metadata)) {
    fields[`subscription_data[metadata][${k}]`] = v
  }

  const data = (await stripePost('/checkout/sessions', fields)) as {
    id?: string
    url?: string
  }
  if (!data.id || !data.url) throw new Error('Stripe Checkout returned an incomplete session')
  return { id: data.id, url: data.url }
}

/** Fetch subscription metadata (membership invoice.paid fallback before checkout completes). */
export async function fetchSubscriptionMetadata(
  subscriptionId: string,
): Promise<Record<string, string>> {
  const data = (await stripeGet(`/subscriptions/${encodeURIComponent(subscriptionId)}`)) as Record<
    string,
    unknown
  >
  const meta = data.metadata
  if (!meta || typeof meta !== 'object') return {}
  return Object.fromEntries(
    Object.entries(meta as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
  )
}

async function stripeDelete(path: string): Promise<void> {
  const key = config.stripe.secretKey
  if (!key) throw new Error('Stripe is not configured')

  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}` },
  })

  const data = (await res.json()) as StripeErrorBody & Record<string, unknown>
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe API DELETE ${path} failed (${res.status})`)
  }
}

/** Cancel a Stripe subscription immediately (best-effort for GDPR deletion). */
export async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  await stripeDelete(`/subscriptions/${encodeURIComponent(subscriptionId)}`)
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
