// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Alert, BgCanvas, Button, Field, Heading, Input, Link, Stack, Text } from '@/components/ui'
import { login } from './actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const result = await login({
      email: form.get('email') as string,
      password: form.get('password') as string,
    })

    if (result.error) {
      setError(result.error)
      setPending(false)
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <>
      <BgCanvas />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <Link href="/" className="brand-logo">
            <span className="brand-logo-bar" aria-hidden />
            TAHTI
          </Link>

          <Heading level={1}>Log in</Heading>
          <Text tone="muted" style={{ marginBottom: '1.5rem' }}>
            Enter your email and password to access your dashboard.
          </Text>

          <form onSubmit={handleSubmit}>
            <Stack gap={4}>
              {error && <Alert variant="error">{error}</Alert>}

              <Field label="Email">
                <Input name="email" type="email" required autoComplete="email" />
              </Field>

              <Field label="Password">
                <Input name="password" type="password" required autoComplete="current-password" />
              </Field>

              <Button variant="primary" size="lg" type="submit" disabled={pending}>
                {pending ? 'Logging in…' : 'Log in'}
              </Button>
            </Stack>
          </form>

          <Text size="sm" tone="muted" style={{ marginTop: '1.5rem' }}>
            Don&apos;t have an account? <Link href="/join">Apply for access</Link>
          </Text>
        </div>
      </div>
    </>
  )
}
