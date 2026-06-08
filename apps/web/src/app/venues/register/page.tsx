// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PublicPageHeader, Stack } from '@tahti/ui'
import { VenueRegisterForm } from './venue-register-form'

export const metadata: Metadata = {
  title: 'Register a venue — Tahti',
  description: 'Submit a cultural venue for the Tahti directory.',
}

export default function VenueRegisterPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/venues/register')

  return (
    <Stack gap={6} className="brand-section">
      <PublicPageHeader
        title="Register a venue"
        back={{ href: '/venues', label: '← Venue directory' }}
      >
        List your space in the Tahti venue directory. After board verification your venue profile
        and calendar will be public at <Link href="/venues">/venues</Link>.
      </PublicPageHeader>
      <VenueRegisterForm />
    </Stack>
  )
}
