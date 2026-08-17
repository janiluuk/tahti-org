// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { safeSignupRedirect } from '@/lib/signup'
import { login, register, resendVerification, verifyTotp } from '../auth/actions'

type AuthMode = 'login' | 'register' | 'totp'

function initialMode(): AuthMode {
  if (typeof window === 'undefined') return 'login'
  const params = new URLSearchParams(window.location.search)
  return params.get('register') !== null || params.get('tab') === 'register' ? 'register' : 'login'
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('login')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [resendPending, setResendPending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [nextPath, setNextPath] = useState('/dashboard')
  const [totpChallengeId, setTotpChallengeId] = useState<string | null>(null)
  const {
    captchaRef,
    required: captchaRequired,
    getToken,
    reset,
  } = useHcaptcha(mode === 'register' && !registerSuccess)

  useEffect(() => {
    setMode(initialMode())
    const params = new URLSearchParams(window.location.search)
    setNextPath(safeSignupRedirect(params.get('next'), '/dashboard'))
  }, [])

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setRegisterSuccess(false)
  }

  // Client-side navigation (not window.location.href) so the shared PlayerProvider
  // — and whatever's playing through it — survives logging in instead of the hard
  // reload tearing the whole app down. router.refresh() re-fetches the destination
  // route's server data so it reflects the just-established session even if that
  // route was already visited (and cached) while signed out.
  // Artists who signed in from a top-level browse page land in the Artist panel
  // (dashboard); deep links (channel, profile, release, …) still honour `next`.
  async function completeLogin() {
    let dest = nextPath
    const browseRoots = new Set(['/', '/listen', '/radio', '/venues'])
    const pathOnly = nextPath.split('?')[0] ?? nextPath
    if (browseRoots.has(pathOnly)) {
      try {
        const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
        const me = await fetch(`${api}/api/auth/me`, { credentials: 'include' })
        if (me.ok) {
          const data = (await me.json()) as { channel?: { slug?: string } | null }
          if (data.channel?.slug) dest = '/dashboard'
        }
      } catch {
        // Keep nextPath if /me is unreachable
      }
    }
    router.push(dest)
    router.refresh()
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    setResendMessage(null)

    const form = new FormData(e.currentTarget)
    const email = form.get('email') as string
    setLoginEmail(email)
    const result = await login({
      email,
      password: form.get('password') as string,
    })

    if (result.error) {
      setError(result.error)
      setPending(false)
    } else if (result.requiresTotp && result.challengeId) {
      setTotpChallengeId(result.challengeId)
      setMode('totp')
      setPending(false)
    } else {
      completeLogin()
    }
  }

  async function handleResend() {
    if (!loginEmail) return
    setResendPending(true)
    setResendMessage(null)
    const result = await resendVerification(loginEmail)
    setResendMessage(result.message)
    setResendPending(false)
  }

  async function handleTotpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!totpChallengeId) return
    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const result = await verifyTotp({
      challengeId: totpChallengeId,
      code: (form.get('code') as string).trim(),
    })

    if (result.error) {
      setError(result.error)
      setPending(false)
    } else {
      completeLogin()
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

  if (mode === 'totp') {
    return (
      <div className="auth-shell">
        <div className="auth-card auth-card--dark">
          <BrandLogo />
          <Heading level={1}>Enter your 2FA code</Heading>
          <Text tone="muted">
            Open your authenticator app and enter the 6-digit code, or use one of your backup codes.
          </Text>

          <form onSubmit={handleTotpSubmit}>
            <Stack gap={4}>
              {error && <Alert variant="error">{error}</Alert>}

              <Field label="Code">
                <Input
                  name="code"
                  type="text"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={9}
                />
              </Field>

              <Button variant="primary" size="lg" type="submit" disabled={pending}>
                <ButtonIcon name="check" />
                {pending ? 'Verifying…' : 'Verify'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                type="button"
                onClick={() => {
                  setTotpChallengeId(null)
                  switchMode('login')
                }}
              >
                Back to log in
              </Button>
            </Stack>
          </form>
        </div>
      </div>
    )
  }

  if (registerSuccess) {
    return (
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
    )
  }

  return (
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
                {error && (
                  <Stack gap={2}>
                    <Alert variant="error">{error}</Alert>
                    {error.toLowerCase().includes('verify your email') && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResend}
                        disabled={resendPending}
                      >
                        {resendPending ? 'Sending…' : 'Resend verification email'}
                      </Button>
                    )}
                  </Stack>
                )}
                {resendMessage && <Alert variant="success">{resendMessage}</Alert>}

                <Field label="Email">
                  <Input name="email" type="email" required autoComplete="email" />
                </Field>

                <Field label="Password">
                  <Input name="password" type="password" required autoComplete="current-password" />
                </Field>

                <Text size="sm" tone="muted">
                  <Link href="/forgot-password">Forgot password?</Link>
                </Text>

                <Button variant="primary" size="lg" type="submit" disabled={pending}>
                  <ButtonIcon name="check" />
                  {pending ? 'Logging in…' : 'Log in'}
                </Button>
              </Stack>
            </form>
          </div>
        ) : (
          <div id="auth-panel-register" role="tabpanel" aria-labelledby="auth-tab-register">
            <Heading level={1}>Create an artist account</Heading>
            <Text tone="muted">
              Your channel URL will be yourname.tahti.live. We&apos;ll email you a verification
              link.
            </Text>

            <form onSubmit={handleRegister}>
              <Stack gap={4}>
                {error && <Alert variant="error">{error}</Alert>}

                <Field label="Email">
                  <Input name="email" type="email" required autoComplete="email" />
                </Field>

                <Field label="Artist name">
                  <Input name="displayName" type="text" required autoComplete="name" />
                </Field>

                <Field label="Username" hint="Lowercase letters, numbers, underscores and hyphens">
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
                  <ButtonIcon name="plus" />
                  {pending ? 'Creating account…' : 'Create account'}
                </Button>
              </Stack>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
