// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
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

  // Load hCaptcha script and render widget when site key is configured
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
      <div style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
        <h1>Check your email</h1>
        <p>
          We&apos;ve sent a verification link to your email address. Click it to activate your
          account.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Create an artist account</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        {error && <p style={{ color: 'red' }}>{error}</p>}

        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>Display name</span>
          <input
            name="displayName"
            type="text"
            required
            autoComplete="name"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>
            Username <small>(your channel URL: tahti.live/u/&lt;username&gt;)</small>
          </span>
          <input
            name="username"
            type="text"
            required
            pattern="[a-z0-9_-]+"
            autoComplete="username"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: 4 }}>Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4 }}
          />
        </label>

        {HCAPTCHA_SITE_KEY && <div ref={captchaRef} />}

        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
