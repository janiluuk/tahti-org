// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandLogo, Heading, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'

export const metadata: Metadata = {
  title: 'Open beta — 1 August 2026 — Tahti',
  description: 'Tahti opens publicly on 1 August 2026. Private beta is now closed.',
}

export default function SignupPage() {
  return (
    <>
      <BgCanvas />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <BrandLogo />
          <Heading level={1}>Private beta is closed</Heading>
          <Text tone="muted">
            We ran a private beta with a small group of artists. The platform opens publicly on{' '}
            <strong>1 August 2026</strong>.
          </Text>
          <Text tone="muted">
            To be notified when registration opens, email{' '}
            <a href="mailto:hello@tahti.fi" className="ui-link">
              hello@tahti.fi
            </a>
            .
          </Text>
          <Link href="/login" className="ui-btn ui-btn--secondary ui-btn--lg auth-tab-switch">
            Sign in
          </Link>
        </div>
      </div>
    </>
  )
}
