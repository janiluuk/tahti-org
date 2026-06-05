// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import { Alert, BrandLogo, Button, Field, Heading, Input, Stack, Text } from '@tahti/ui'
import { register } from './actions'

const HCAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? ''

declare global {
  interface Window {
    hcaptcha?: {
      render(container: string | HTMLElement, params: Record<string, string>): string
      getResponse(widgetId?: string): string
      reset(widgetId?: string): void
    }
    onHcaptchaLoad?: () => void
  }
}

export default function JoinPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)
  const captchaRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!HCAPTCHA_SITE_KEY) return

    const render = () => {
      if (!captchaRef.current || !window.hcaptcha) return
      widgetIdRef.current = window.hcaptcha.render(captchaRef.current, {
        sitekey: HCAPTCHA_SITE_KEY,
        theme: 'light',
      })
    }

    if (window.hcaptcha) {
      render()
    } else {
      window.onHcaptchaLoad = render
      const script = document.createElement('script')
      script.src = 'https://js.hcaptcha.com/1/api.js?onload=onHcaptchaLoad&render=explicit'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const hcaptchaToken =
      HCAPTCHA_SITE_KEY && window.hcaptcha
        ? window.hcaptcha.getResponse(widgetIdRef.current)
        : undefined

    if (HCAPTCHA_SITE_KEY && !hcaptchaToken) {
      setError('Please complete the captcha')
      setPending(false)
      return
    }

    const form = new FormData(e.currentTarget)
    const result = await register({
      email: form.get('email') as string,
      password: form.get('password') as string,
      username: form.get('username') as string,
      displayName: form.get('displayName') as string,
      hcaptchaToken,
    })

    setPending(false)
    if (result.error) {
      setError(result.error)
      window.hcaptcha?.reset(widgetIdRef.current)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="auth-card">
        <BrandLogo />
        <Heading level={1}>Check your email</Heading>
        <Text tone="muted">
          We&apos;ve sent a verification link to your email address. Click it to activate your
          account.
        </Text>
      </div>
    )
  }

  return (
    <div className="auth-card">
      <BrandLogo />
      <Heading level={1}>Create an artist account</Heading>
      <Text tone="muted">
        Invite-only during early access. Your channel URL will be tahti.live/u/yourname.
      </Text>

      <form onSubmit={handleSubmit}>
        <Stack gap={4}>
          {error && <Alert variant="error">{error}</Alert>}

          <Field label="Email">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>

          <Field label="Display name">
            <Input name="displayName" type="text" required autoComplete="name" />
          </Field>

          <Field label="Username" hint="Letters, numbers, underscores and hyphens only">
            <Input
              name="username"
              type="text"
              required
              pattern="[a-z0-9_-]+"
              autoComplete="username"
            />
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

          {HCAPTCHA_SITE_KEY && <div ref={captchaRef} />}

          <Button type="submit" variant="primary" size="lg" disabled={pending}>
            {pending ? 'Creating account…' : 'Create account'}
          </Button>
        </Stack>
      </form>
    </div>
  )
}
