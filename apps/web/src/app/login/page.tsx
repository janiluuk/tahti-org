// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { Alert, BrandLogo, Button, Field, Heading, Input, Stack, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { useHcaptcha } from '@/lib/use-hcaptcha'
import { login, register } from '../auth/actions'

type AuthMode = 'login' | 'register'

function initialMode(): AuthMode {
  if (typeof window === 'undefined') return 'login'
  const params = new URLSearchParams(window.location.search)
  return params.get('register') !== null || params.get('tab') === 'register' ? 'register' : 'login'
}

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const {
    captchaRef,
    required: captchaRequired,
    getToken,
    reset,
  } = useHcaptcha(mode === 'register' && !registerSuccess)

  useEffect(() => {
    setMode(initialMode())
  }, [])

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setRegisterSuccess(false)
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
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

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const hcaptchaToken = getToken()
    if (captchaRequired && !hcaptchaToken) {
      setError('Please complete the captcha')
      setPending(false)
      return
    }

    const form = new FormData(e.currentTarget)
    const result = await register({
      email: form.get('email') as string,
      password: form.get('password') as string,
      username: (form.get('username') as string).trim().toLowerCase(),
      displayName: (form.get('displayName') as string).trim(),
      hcaptchaToken,
    })

    setPending(false)
    if (result.error) {
      setError(result.error)
      reset()
    } else {
      setRegisterSuccess(true)
    }
  }

  if (registerSuccess) {
    return (
      <>
        <BgCanvas />
        <div className="auth-shell">
          <div className="auth-card auth-card--dark">
            <BrandLogo />
            <Heading level={1}>Check your email</Heading>
            <Text tone="muted">
              We&apos;ve sent a verification link to your email address. Click it to activate your
              account, then log in here.
            </Text>
            <Button
              variant="secondary"
              size="lg"
              className="auth-tab-switch"
              onClick={() => switchMode('login')}
            >
              Back to log in
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <BgCanvas />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <BrandLogo />

          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              id="auth-tab-login"
              aria-selected={mode === 'login'}
              aria-controls="auth-panel-login"
              className={`auth-tabs__tab${mode === 'login' ? ' auth-tabs__tab--active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              id="auth-tab-register"
              aria-selected={mode === 'register'}
              aria-controls="auth-panel-register"
              className={`auth-tabs__tab${mode === 'register' ? ' auth-tabs__tab--active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Create account
            </button>
          </div>

          {mode === 'login' ? (
            <div id="auth-panel-login" role="tabpanel" aria-labelledby="auth-tab-login">
              <Heading level={1}>Log in</Heading>
              <Text tone="muted">Enter your email and password to access your dashboard.</Text>

              <form onSubmit={handleLogin}>
                <Stack gap={4}>
                  {error && <Alert variant="error">{error}</Alert>}

                  <Field label="Email">
                    <Input name="email" type="email" required autoComplete="email" />
                  </Field>

                  <Field label="Password">
                    <Input
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                    />
                  </Field>

                  <Button variant="primary" size="lg" type="submit" disabled={pending}>
                    {pending ? 'Logging in…' : 'Log in'}
                  </Button>
                </Stack>
              </form>
            </div>
          ) : (
            <div id="auth-panel-register" role="tabpanel" aria-labelledby="auth-tab-register">
              <Heading level={1}>Create an artist account</Heading>
              <Text tone="muted">
                Your channel URL will be tahti.live/u/yourname. We&apos;ll email you a verification
                link.
              </Text>

              <form onSubmit={handleRegister}>
                <Stack gap={4}>
                  {error && <Alert variant="error">{error}</Alert>}

                  <Field label="Email">
                    <Input name="email" type="email" required autoComplete="email" />
                  </Field>

                  <Field label="Display name">
                    <Input name="displayName" type="text" required autoComplete="name" />
                  </Field>

                  <Field
                    label="Username"
                    hint="Lowercase letters, numbers, underscores and hyphens"
                  >
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

                  {captchaRequired && <div ref={captchaRef} />}

                  <Button variant="primary" size="lg" type="submit" disabled={pending}>
                    {pending ? 'Creating account…' : 'Create account'}
                  </Button>
                </Stack>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
