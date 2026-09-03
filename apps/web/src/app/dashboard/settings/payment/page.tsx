// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDashboardUser } from '@/lib/dashboard-session'
import MembershipPanel from '../../membership-panel'

interface MembershipInfo {
  status: string
  isMember: boolean
  memberNumber: number | null
  priceCents: number
  emailVerified: boolean
  renewalDueAt?: string | null
  hasStripeSubscription?: boolean
  subscriptionMigrationRequired?: boolean
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

export default async function PaymentSettingsPage() {
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
      <h1 className="ui-heading ui-heading--2">Payment</h1>
      {membershipInfo && (
        <MembershipPanel
          status={membershipInfo.status}
          isMember={membershipInfo.isMember}
          memberNumber={membershipInfo.memberNumber}
          priceCents={membershipInfo.priceCents}
          emailVerified={membershipInfo.emailVerified}
          userEmail={user.email}
          hasStripeSubscription={membershipInfo.hasStripeSubscription}
          renewalDueAt={membershipInfo.renewalDueAt}
          subscriptionMigrationRequired={membershipInfo.subscriptionMigrationRequired}
        />
      )}
    </div>
  )
}
