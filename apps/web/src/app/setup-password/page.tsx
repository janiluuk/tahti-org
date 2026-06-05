// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandLogo, Heading, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { SetupPasswordForm } from './setup-password-form'

export const metadata: Metadata = {
  title: 'Create password — Tahti',
  description: 'Set your Tahti artist account password.',
}

export default async function SetupPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token?.trim()
  if (!token) {
    return (
      <>
        <BgCanvas />
        <div className="auth-shell">
          <div className="auth-card auth-card--dark">
            <BrandLogo />
            <Heading level={1}>Invalid link</Heading>
            <Text tone="muted">Use the password setup link from your beta invite email.</Text>
          </div>
        </div>
      </>
    )
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/auth/setup-password?token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    email?: string
    username?: string
    displayName?: string
  }

  if (!res.ok || !data.email || !data.username || !data.displayName) {
    return (
      <>
        <BgCanvas />
        <div className="auth-shell">
          <div className="auth-card auth-card--dark">
            <BrandLogo />
            <Heading level={1}>Link expired</Heading>
            <Text tone="muted">{data.error ?? 'This setup link is invalid or has expired.'}</Text>
            <Text tone="muted">
              Contact <a href="mailto:support@tahti.live">support@tahti.live</a> or{' '}
              <Link href="/login">log in</Link> if you already have a password.
            </Text>
          </div>
        </div>
      </>
    )
  }

  return (
    <SetupPasswordForm
      token={token}
      info={{ email: data.email, username: data.username, displayName: data.displayName }}
    />
  )
}
