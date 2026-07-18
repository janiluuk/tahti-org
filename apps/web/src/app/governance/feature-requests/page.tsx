// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PublicPageHeader } from '@tahti/ui'
import FeatureRequestsList from './feature-requests-list'
import type { FeatureRequestRef } from './actions'

interface MeResponse {
  isMember: boolean
}

export default async function FeatureRequestsPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  let me: MeResponse
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) redirect('/login')
    me = (await res.json()) as MeResponse
  } catch {
    redirect('/login')
  }

  if (!me.isMember) {
    return (
      <PublicPageHeader
        title="Feature requests"
        back={{ href: '/governance', label: '← Governance' }}
      >
        This board is for Tahti ry members. Activate your membership to suggest and vote on
        features.
      </PublicPageHeader>
    )
  }

  const res = await fetch(`${apiUrl}/api/v1/governance/feature-requests`, {
    headers: { Cookie: cookie },
    cache: 'no-store',
  })
  const requests: FeatureRequestRef[] = res.ok ? ((await res.json()) as FeatureRequestRef[]) : []

  return (
    <>
      <PublicPageHeader
        title="Feature requests"
        back={{ href: '/governance', label: '← Governance' }}
      >
        Suggest features for Tahti and vote on what other members have proposed. The board reviews
        this board every quarter and marks what&apos;s planned, in progress, or declined.
      </PublicPageHeader>

      <section className="brand-section">
        <FeatureRequestsList initialRequests={requests} />
      </section>
    </>
  )
}
