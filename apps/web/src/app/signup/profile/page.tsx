// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignupProfileForm } from './profile-form'

async function fetchMe(sessionValue: string): Promise<{ displayName: string } | null> {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { displayName: string }
    return { displayName: data.displayName }
  } catch {
    return null
  }
}

export default async function SignupProfilePage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/signup/profile')

  const me = await fetchMe(sessionCookie.value)
  if (!me) redirect('/login?next=/signup/profile')

  return <SignupProfileForm displayName={me.displayName} />
}
