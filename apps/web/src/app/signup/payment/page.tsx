// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { fetchSignupMembershipStatus } from '../actions'
import { SignupPaymentPanel } from './payment-panel'

export default async function SignupPaymentPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/signup/payment')

  const membership = await fetchSignupMembershipStatus()
  if (!membership) redirect('/login?next=/signup/payment')

  return (
    <Suspense fallback={null}>
      <SignupPaymentPanel isMember={membership.isMember} emailVerified={membership.emailVerified} />
    </Suspense>
  )
}
