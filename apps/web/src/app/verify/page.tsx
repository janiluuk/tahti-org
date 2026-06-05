// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Alert, Heading, Link, Stack, Text } from '@tahti/ui'

interface Props {
  searchParams: { token?: string }
}

export default async function VerifyPage({ searchParams }: Props) {
  const token = searchParams.token

  if (!token) {
    return (
      <div className="auth-card">
        <Heading level={1}>Invalid verification link</Heading>
        <Text tone="muted">This link is missing a token. Please use the link from your email.</Text>
      </div>
    )
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  let message = ''
  let isError = false

  try {
    const response = await fetch(`${apiUrl}/api/auth/verify?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      cache: 'no-store',
    })
    const data = (await response.json()) as { message?: string; error?: string }
    if (!response.ok) {
      message = data.error ?? 'Verification failed'
      isError = true
    } else {
      message = data.message ?? 'Email verified'
    }
  } catch {
    message = 'Could not reach the server'
    isError = true
  }

  return (
    <div className="auth-card">
      <Stack gap={4}>
        <Heading level={1}>{isError ? 'Verification failed' : 'Email verified!'}</Heading>
        <Alert variant={isError ? 'error' : 'success'}>{message}</Alert>
        {!isError && (
          <Text>
            <Link href="/login">Log in to your account</Link>
          </Text>
        )}
      </Stack>
    </div>
  )
}
