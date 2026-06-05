// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const STRIPE_API = 'https://api.stripe.com/v1'

export async function createConnectTransfer(params: {
  amountCents: number
  destinationAccountId: string
  idempotencyKey: string
  description: string
}): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')

  const body = new URLSearchParams({
    amount: String(params.amountCents),
    currency: 'eur',
    destination: params.destinationAccountId,
    description: params.description,
  })

  const res = await fetch(`${STRIPE_API}/transfers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': params.idempotencyKey,
    },
    body,
  })

  const data = (await res.json()) as { id?: string; error?: { message?: string } }
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message ?? `Stripe transfer failed (${res.status})`)
  }
  return data.id
}

export async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return

  const res = await fetch(`${STRIPE_API}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}` },
  })

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } }
    throw new Error(data.error?.message ?? `Stripe cancel failed (${res.status})`)
  }
}
