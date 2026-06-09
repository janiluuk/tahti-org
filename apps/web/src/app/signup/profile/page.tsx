// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BrandLogo, Heading, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'

export default function SignupProfilePage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/signup/profile')

  return (
    <>
      <BgCanvas />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <BrandLogo />
          <Heading level={1}>Set up your profile</Heading>
          <Text tone="muted">
            Add a bio, genre tags, and links to your artist profile so listeners can discover you.
          </Text>
          <Text tone="muted" size="sm">
            You can do this now or any time from your dashboard.
          </Text>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginTop: '0.5rem',
            }}
          >
            <Link href="/dashboard/settings/profile" className="ui-btn ui-btn--primary">
              Set up profile now
            </Link>
            <Link href="/signup/broadcast" className="ui-btn ui-btn--ghost">
              Skip for now →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
