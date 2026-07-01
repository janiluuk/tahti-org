// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandLogo, Heading, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { isSignupOpen } from '@/lib/signup'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: isSignupOpen() ? 'Create artist account — Tahti' : 'Open beta — 1 August 2026 — Tahti',
  description: isSignupOpen()
    ? 'Create your Tahti artist account — broadcast, archive, and connect with listeners.'
    : 'Tahti opens publicly on 1 August 2026. Private beta is now closed.',
}

function SignupClosed() {
  return (
    <>
      <BgCanvas variant="subtle" />
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

export default function SignupPage() {
  if (!isSignupOpen()) return <SignupClosed />
  return <SignupForm />
}
