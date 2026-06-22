// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboardUser } from '@/lib/dashboard-session'
import FanSubscriptionsPanel from '../../fan-subscriptions'

interface FanTier {
  id: string
  name: string
  amountCents: number
  description: string | null
  perks: string[]
  active: boolean
}

interface FanConnectStatus {
  stripeConfigured: boolean
  paymentsReady: boolean
  chargesEnabled: boolean
  detailsSubmitted: boolean
}

interface FanPayoutStats {
  pending: number
  failed: number
  paidLast30Days: number
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

export default async function FanSubsSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [user, fanTiers, fanConnect, fanPayoutStats] = await Promise.all([
    getDashboardUser(),
    apiFetch<FanTier[]>(apiUrl, cookie, '/api/me/fan-tiers'),
    apiFetch<FanConnectStatus>(apiUrl, cookie, '/api/me/fan-subs/connect'),
    apiFetch<FanPayoutStats>(apiUrl, cookie, '/api/me/fan-sub-payouts'),
  ])
  if (!user) redirect('/login')

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Fan subscriptions</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Configure paid fan-sub tiers and perks. Payout history lives on{' '}
            <a href="/dashboard/revenue">Revenue</a>.
          </p>
        </div>
      </div>

      <FanSubscriptionsPanel
        initial={fanTiers ?? []}
        username={user.username}
        apiUrl={apiUrl}
        connect={
          fanConnect ?? {
            stripeConfigured: false,
            paymentsReady: true,
            chargesEnabled: true,
            detailsSubmitted: true,
          }
        }
        payoutStats={fanPayoutStats ?? { pending: 0, failed: 0, paidLast30Days: 0 }}
      />
    </div>
  )
}
