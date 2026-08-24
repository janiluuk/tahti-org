// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Alert, BrandLogo, Button, ButtonIcon, Field, Heading, Input, Stack, Text } from '@tahti/ui'
import { resetPassword } from './actions'

type ResetInfo = {
  email: string
  username: string
  displayName: string
}

export function ResetPasswordForm({ token, info }: { token: string; info: ResetInfo }) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setSubmitError(null)
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirm = String(form.get('confirm') ?? '')
    if (password !== confirm) {
      setSubmitError('Passwords do not match')
      setPending(false)
      return
    }
    const { error } = await resetPassword({ token, password })
    setPending(false)
    if (error) {
      setSubmitError(error)
      return
    }
    window.location.href = '/dashboard'
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card--dark">
        <BrandLogo />
        <Heading level={1}>Choose a new password</Heading>
        <Text tone="muted">
          Hi {info.displayName}, set a new password for <strong>{info.email}</strong>.
        </Text>

        <form onSubmit={onSubmit}>
          <Stack gap={4}>
            {submitError && <Alert variant="error">{submitError}</Alert>}

            <Field
              label="New password"
              hint="At least 10 characters, with uppercase, lowercase, and a number"
            >
              <Input
                name="password"
                type="password"
                required
                minLength={10}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,}"
                title="At least 10 characters, with uppercase, lowercase, and a number"
                autoComplete="new-password"
              />
            </Field>

            <Field label="Confirm new password">
              <Input
                name="confirm"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
              />
            </Field>

            <Button variant="primary" size="lg" type="submit" disabled={pending}>
              <ButtonIcon name="check" />
              {pending ? 'Saving…' : 'Reset password & sign in'}
            </Button>

            <Text size="sm" tone="muted">
              <Link href="/login">Back to log in</Link>
            </Text>
          </Stack>
        </form>
      </div>
    </div>
  )
}
