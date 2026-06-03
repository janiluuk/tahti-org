// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import { PublicBrandShell } from '@/components/public-brand-shell'
import { Button, Callout, FormField, Input } from '@/components/ui/from-tahti-ui'
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
      <PublicBrandShell center>
        <h1>Check your email</h1>
        <p className="brand-muted">
          We&apos;ve sent a verification link to your email address. Click it to activate your
          account.
        </p>
      </PublicBrandShell>
    )
  }

  return (
    <PublicBrandShell center>
      <h1>Create an artist account</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {error && <Callout label="Error">{error}</Callout>}

        <FormField label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </FormField>

        <FormField label="Display name">
          <Input name="displayName" type="text" required autoComplete="name" />
        </FormField>

        <FormField label="Username (tahti.live/u/…)">
          <Input
            name="username"
            type="text"
            required
            pattern="[a-z0-9_-]+"
            autoComplete="username"
          />
        </FormField>

        <FormField label="Password">
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </FormField>

        {HCAPTCHA_SITE_KEY && <div ref={captchaRef} />}

        <Button type="submit" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </PublicBrandShell>
  )
}
