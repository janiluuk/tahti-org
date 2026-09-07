// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboardUser } from '@/lib/dashboard-session'
import PurchaseTiersPanel from '../../purchase-tiers'

interface PurchaseTier {
  id: string
  name: string
  priceCents: number
  priceOptional: boolean
  description: string | null
  active: boolean
}

interface Order {
  id: string
  amountCents: number
  createdAt: string
  tier: { id: string; name: string }
  buyer: { username: string; displayName: string; avatarUrl: string | null }
}

interface FanConnectStatus {
  stripeConfigured: boolean
  paymentsReady: boolean
  chargesEnabled: boolean
  detailsSubmitted: boolean
}

async function apiFetch<T>(apiUrl: string, cookie: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export default async function PurchaseTiersSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [user, tiers, orders, connect, storeSettings] = await Promise.all([
    getDashboardUser(),
    apiFetch<PurchaseTier[]>(apiUrl, cookie, '/api/me/purchase-tiers'),
    apiFetch<Order[]>(apiUrl, cookie, '/api/me/purchase-tiers/orders'),
    // Same Connect account backs both fan-subs and one-time tiers.
    apiFetch<FanConnectStatus>(apiUrl, cookie, '/api/me/fan-subs/connect'),
    apiFetch<{ storeEnabled: boolean }>(apiUrl, cookie, '/api/me/store-settings'),
  ])
  if (!user) redirect('/login')

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">One-time tiers</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Price a track for one-time purchase, then assign it in the track editor&apos;s Access
            tab. Payout history lives on <a href="/dashboard/revenue">Revenue</a>.
          </p>
        </div>
      </div>

      <PurchaseTiersPanel
        initial={tiers ?? []}
        orders={orders ?? []}
        connect={connect ?? { stripeConfigured: false, paymentsReady: true }}
        storeEnabled={storeSettings?.storeEnabled ?? false}
      />
    </div>
  )
}
