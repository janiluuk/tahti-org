// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import {
  Alert,
  BrandLogo,
  Button,
  ButtonIcon,
  Field,
  Heading,
  Input,
  Link,
  Stack,
  Text,
} from '@tahti/ui'
import { useHcaptcha } from '@/lib/use-hcaptcha'
import { forgotPassword } from './actions'

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { captchaRef, required: captchaRequired, getToken, reset } = useHcaptcha(true)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setMessage(null)

    const hcaptchaToken = getToken()
    const form = new FormData(e.currentTarget)
    const result = await forgotPassword({
      email: form.get('email') as string,
      hcaptchaToken,
    })
    setMessage(result.message)
    setPending(false)
    reset()
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card--dark">
        <BrandLogo />
        <Heading level={1}>Reset your password</Heading>
        <Text tone="muted">
          Enter the email on your Tahti account and we&apos;ll send a link to choose a new password.
        </Text>

        <form onSubmit={onSubmit}>
          <Stack gap={4}>
            {message && <Alert variant="success">{message}</Alert>}

            <Field label="Email">
              <Input name="email" type="email" required autoComplete="email" />
            </Field>

            {captchaRequired && <div ref={captchaRef} />}

            <Button variant="primary" size="lg" type="submit" disabled={pending}>
              <ButtonIcon name="check" />
              {pending ? 'Sending…' : 'Send reset link'}
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
