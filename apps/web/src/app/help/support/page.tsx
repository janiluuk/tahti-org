// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Heading, Link, Text } from '@tahti/ui'
import { cookies } from 'next/headers'
import { SupportContactForm } from './support-contact-form'

async function fetchMeEmail(): Promise<string | undefined> {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) return undefined
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/auth/me`, {
    headers: { Cookie: `tahti_session=${sessionCookie.value}` },
    cache: 'no-store',
  })
  if (!res.ok) return undefined
  const me = (await res.json()) as { email: string }
  return me.email
}

export default async function SupportHelpPage() {
  const email = await fetchMeEmail()

  return (
    <article className="brand-prose">
      <Text size="sm">
        <Link href="/dashboard">← Dashboard</Link>
      </Text>
      <Heading level={1}>Contact support</Heading>
      <Text tone="muted">
        Questions about engagement units, streaming, billing, or your account. Signed-in artists do
        not need to enter an email.
      </Text>
      <SupportContactForm defaultEmail={email} />
    </article>
  )
}
