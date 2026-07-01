// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Alert, BrandLogo, Button, ButtonIcon, Field, Heading, Input, Stack, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { setupPassword } from './actions'

type SetupInfo = {
  email: string
  username: string
  displayName: string
}

export function SetupPasswordForm({ token, info }: { token: string; info: SetupInfo }) {
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
    const { error } = await setupPassword({ token, password })
    setPending(false)
    if (error) {
      setSubmitError(error)
      return
    }
    window.location.href = '/dashboard'
  }

  return (
    <>
      <BgCanvas variant="subtle" />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <BrandLogo />
          <Heading level={1}>Create your password</Heading>
          <Text tone="muted">
            Welcome, {info.displayName}. Your channel will be{' '}
            <strong>tahti.live/u/{info.username}</strong>.
          </Text>

          <form onSubmit={onSubmit}>
            <Stack gap={4}>
              {submitError && <Alert variant="error">{submitError}</Alert>}

              <Field label="Email">
                <Input value={info.email} readOnly disabled />
              </Field>

              <Field label="Password" hint="At least 8 characters">
                <Input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <Field label="Confirm password">
                <Input
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <Button variant="primary" size="lg" type="submit" disabled={pending}>
                <ButtonIcon name="check" />
                {pending ? 'Saving…' : 'Create password & sign in'}
              </Button>

              <Text size="sm" tone="muted">
                Already set a password? <Link href="/login">Log in</Link>
              </Text>
            </Stack>
          </form>
        </div>
      </div>
    </>
  )
}
