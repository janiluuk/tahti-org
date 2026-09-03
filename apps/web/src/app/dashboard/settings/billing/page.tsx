// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboardUser } from '@/lib/dashboard-session'
import { MembershipStatusStrip } from '../_membership-status-strip'
import BillingPanel from './_billing-panel'

interface MembershipInfo {
  status: string
  isMember: boolean
  memberNumber: number | null
  hasStripeSubscription?: boolean
  stripeEnabled?: boolean
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

export default async function BillingSettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [user, membershipInfo] = await Promise.all([
    getDashboardUser(),
    apiFetch<MembershipInfo>(apiUrl, cookie, '/api/me/membership'),
  ])
  if (!user) redirect('/login')

  return (
    <div className="studio-settings-stack">
      <h1 className="ui-heading ui-heading--2">Billing</h1>
      <MembershipStatusStrip
        isMember={membershipInfo?.isMember ?? false}
        memberNumber={membershipInfo?.memberNumber ?? null}
        status={membershipInfo?.status ?? 'PENDING_EMAIL'}
      />
      <BillingPanel
        isMember={membershipInfo?.isMember ?? false}
        hasStripeSubscription={membershipInfo?.hasStripeSubscription ?? false}
        stripeConfigured={membershipInfo?.stripeEnabled ?? false}
      />
    </div>
  )
}
