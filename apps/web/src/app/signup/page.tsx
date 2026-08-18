// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandLogo, Heading, Text } from '@tahti/ui'
import { isSignupOpen } from '@/lib/signup'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: isSignupOpen() ? 'Create artist account — Tahti' : 'Registration closed — Tahti',
  description: isSignupOpen()
    ? 'Create your Tahti artist account — broadcast, archive, and connect with listeners.'
    : 'Tahti registration is temporarily closed.',
}

function SignupClosed() {
  return (
    <>
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <BrandLogo />
          <Heading level={1}>Registration is temporarily closed</Heading>
          <Text tone="muted">
            We&apos;re not accepting new sign-ups right now while we complete some
            infrastructure work. Existing accounts aren&apos;t affected.
          </Text>
          <Text tone="muted">
            To be notified when registration reopens, email{' '}
            <a href="mailto:hello@tahti.live" className="ui-link">
              hello@tahti.live
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
