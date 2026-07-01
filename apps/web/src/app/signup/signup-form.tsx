// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Alert,
  BrandLogo,
  Button,
  ButtonIcon,
  Field,
  Heading,
  Input,
  Stack,
  StatusPill,
  Text,
} from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { useHcaptcha } from '@/lib/use-hcaptcha'
import { SIGNUP_TIER_KEY, type SignupTier } from '@/lib/signup'
import { register } from '@/app/auth/actions'
import { SignupWizard } from './signup-wizard'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const HANDLE_PATTERN = /^[a-z0-9_-]{2,32}$/

type HandleStatus = 'idle' | 'checking' | 'available' | 'taken'

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [tier, setTier] = useState<SignupTier>('free')
  const [handle, setHandle] = useState('')
  const [handleStatus, setHandleStatus] = useState<HandleStatus>('idle')
  const [handleSuggestions, setHandleSuggestions] = useState<string[]>([])
  const { captchaRef, required: captchaRequired, getToken, reset } = useHcaptcha(!done)

  useEffect(() => {
    if (!HANDLE_PATTERN.test(handle)) {
      setHandleStatus('idle')
      setHandleSuggestions([])
      return
    }
    setHandleStatus('checking')
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/auth/username-available?username=${encodeURIComponent(handle)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { available: boolean; suggestions?: string[] } | null) => {
          if (!data) {
            setHandleStatus('idle')
            return
          }
          setHandleStatus(data.available ? 'available' : 'taken')
          setHandleSuggestions(data.suggestions ?? [])
        })
        .catch(() => setHandleStatus('idle'))
    }, 400)
    return () => clearTimeout(timer)
  }, [handle])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const password = form.get('password') as string
    const confirm = form.get('confirm') as string
    if (password !== confirm) {
      setError('Passwords do not match')
      setPending(false)
      return
    }

    const hcaptchaToken = captchaRequired ? getToken() : undefined
    if (captchaRequired && !hcaptchaToken) {
      setError('Please complete the captcha')
      setPending(false)
      return
    }

    const result = await register({
      email: form.get('email') as string,
      username: (form.get('username') as string).toLowerCase().trim(),
      displayName: form.get('displayName') as string,
      password,
      hcaptchaToken,
    })

    setPending(false)
    if (result.error) {
      setError(result.error)
      reset()
      return
    }

    setDone(true)
    sessionStorage.setItem(SIGNUP_TIER_KEY, tier)
  }

  if (done) {
    return (
      <>
        <BgCanvas />
        <div className="auth-shell">
          <div className="auth-card auth-card--dark">
            <BrandLogo />
            <Heading level={1}>Check your email</Heading>
            <Text tone="muted">
              We sent a verification link to the address you provided. Click it to activate your
              account, then sign in.
            </Text>
            <Text tone="muted" size="sm">
              <Link href={`/login?next=${tier === 'free' ? '/signup/profile' : '/signup/payment'}`}>
                Sign in to continue setup →
              </Link>
            </Text>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <BgCanvas />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark signup-card">
          <BrandLogo />
          <SignupWizard current="account" />
          <Heading level={3} className="signup-card__title">
            Start your channel
          </Heading>
          <Text tone="muted" size="sm" className="signup-card__subtitle">
            One URL that always plays. Yours.
          </Text>
          <Text tone="muted" size="sm">
            Already have an account? <Link href="/login">Sign in</Link>
          </Text>

          <form onSubmit={onSubmit}>
            <Stack gap={4}>
              {error && <Alert variant="error">{error}</Alert>}

              <Field label="Email" htmlFor="signup-email">
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>

              <Field
                label="Handle"
                htmlFor="signup-username"
                hint={
                  handleStatus === 'available' ? (
                    <span className="signup-handle-status signup-handle-status--ok">
                      ✓ available — your channel will live at{' '}
                      <span className="signup-handle-status__url">{handle}.tahti.live</span>
                    </span>
                  ) : handleStatus === 'taken' ? (
                    <span className="signup-handle-status signup-handle-status--error">
                      Already taken
                      {handleSuggestions.length > 0 && (
                        <>
                          {' — try '}
                          {handleSuggestions.map((s, i) => (
                            <span key={s}>
                              {i > 0 && ' or '}
                              <button
                                type="button"
                                className="signup-handle-suggestion"
                                onClick={() => setHandle(s)}
                              >
                                {s}
                              </button>
                            </span>
                          ))}
                        </>
                      )}
                    </span>
                  ) : (
                    `Lowercase letters, numbers, - and _ only. Your channel URL: ${handle || 'your-handle'}.tahti.live`
                  )
                }
              >
                <Input
                  id="signup-username"
                  name="username"
                  required
                  minLength={2}
                  maxLength={32}
                  pattern="[a-z0-9_-]+"
                  autoComplete="username"
                  placeholder="dj-moonrise"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase())}
                />
              </Field>

              <Field label="Display name" htmlFor="signup-display-name">
                <Input
                  id="signup-display-name"
                  name="displayName"
                  required
                  maxLength={64}
                  autoComplete="name"
                  placeholder="DJ Moonrise"
                />
              </Field>

              <Field label="Password" htmlFor="signup-password" hint="At least 8 characters">
                <Input
                  id="signup-password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <Field label="Confirm password" htmlFor="signup-confirm">
                <Input
                  id="signup-confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <fieldset className="signup-fieldset">
                <legend className="signup-fieldset__legend">Artist tier</legend>
                <div className="signup-tier-grid">
                  <label
                    className={`signup-tier-card${tier === 'free' ? ' signup-tier-card--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="tier"
                      value="free"
                      checked={tier === 'free'}
                      onChange={() => setTier('free')}
                      className="signup-tier-radio"
                    />
                    <span className="signup-tier-card__name">Free</span>
                    <span className="signup-tier-card__price">€0</span>
                    <span className="signup-tier-card__desc">MP3 192 · 1 hr live/week</span>
                    <span className="signup-tier-card__desc">Full product otherwise</span>
                  </label>
                  <label
                    className={`signup-tier-card signup-tier-card--member${tier === 'member' ? ' signup-tier-card--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="tier"
                      value="member"
                      checked={tier === 'member'}
                      onChange={() => setTier('member')}
                      className="signup-tier-radio"
                    />
                    <span className="signup-tier-card__header">
                      <span className="signup-tier-card__name">Tahti</span>
                      <StatusPill tone="cyan">MEMBER</StatusPill>
                    </span>
                    <span className="signup-tier-card__price signup-tier-card__price--cyan">
                      €40/yr
                    </span>
                    <span className="signup-tier-card__desc">Lossless FLAC · unlimited live</span>
                    <span className="signup-tier-card__desc">Vote at AGM · grant-eligible</span>
                  </label>
                </div>
              </fieldset>

              {captchaRequired && <div ref={captchaRef} />}

              <Button
                type="submit"
                variant="primary"
                disabled={pending}
                className="signup-continue-btn"
              >
                <ButtonIcon name="arrowRight" />
                {pending ? 'Creating account…' : 'Continue →'}
              </Button>

              <Text tone="muted" size="sm">
                By creating an account you agree to the <Link href="/terms">terms of service</Link>{' '}
                and <Link href="/privacy">privacy policy</Link>.
              </Text>

              <Text tone="muted" size="sm" className="signup-footnote">
                No upgrade pressure. Free is a complete product — the constitution says so.
              </Text>
            </Stack>
          </form>
        </div>
      </div>
    </>
  )
}
