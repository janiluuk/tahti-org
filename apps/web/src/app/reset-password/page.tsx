// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandLogo, Heading, Text } from '@tahti/ui'
import { ResetPasswordForm } from './reset-password-form'

export const metadata: Metadata = {
  title: 'Reset password — Tahti',
  description: 'Choose a new password for your Tahti account.',
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token?.trim()
  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <BrandLogo />
          <Heading level={1}>Invalid link</Heading>
          <Text tone="muted">Use the password reset link from your email.</Text>
        </div>
      </div>
    )
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/auth/reset-password?token=${encodeURIComponent(token)}`, {
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
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <BrandLogo />
          <Heading level={1}>Link expired</Heading>
          <Text tone="muted">{data.error ?? 'This reset link is invalid or has expired.'}</Text>
          <Text tone="muted">
            Request a new one from the <Link href="/forgot-password">password reset page</Link>, or{' '}
            <Link href="/login">log in</Link> if you remember your password.
          </Text>
        </div>
      </div>
    )
  }

  return (
    <ResetPasswordForm
      token={token}
      info={{ email: data.email, username: data.username, displayName: data.displayName }}
    />
  )
}
