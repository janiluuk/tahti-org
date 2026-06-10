// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Alert, BrandLogo, Button, Field, Heading, Input, Stack, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { useHcaptcha } from '@/lib/use-hcaptcha'
import { SIGNUP_TIER_KEY, type SignupTier } from '@/lib/signup'
import { register } from '@/app/auth/actions'
import { SignupWizard } from './signup-wizard'

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [tier, setTier] = useState<SignupTier>('free')
  const { captchaRef, required: captchaRequired, getToken, reset } = useHcaptcha(!done)

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
              <Link href="/login?next=/signup/payment">Sign in to continue setup →</Link>
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
        <div className="auth-card auth-card--dark auth-card--wide">
          <BrandLogo />
          <SignupWizard current="account" />
          <Heading level={1}>Create your artist account</Heading>
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
                hint="Lowercase letters, numbers, - and _ only. Your channel URL: tahti.live/c/your-handle"
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
                <legend className="signup-fieldset__legend">Membership tier</legend>
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
                    <span className="signup-tier-card__desc">
                      MP3 192 kbps live &amp; archive, smart links, newsletter, analytics, fan-subs,
                      grant eligibility. Everything.
                    </span>
                  </label>
                  <label
                    className={`signup-tier-card${tier === 'paid' ? ' signup-tier-card--active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="tier"
                      value="paid"
                      checked={tier === 'paid'}
                      onChange={() => setTier('paid')}
                      className="signup-tier-radio"
                    />
                    <span className="signup-tier-card__name">Paid member</span>
                    <span className="signup-tier-card__price">€40/year</span>
                    <span className="signup-tier-card__desc">
                      FLAC lossless for you and your listeners, priority support, Stash file
                      storage, and a vote at the AGM.
                    </span>
                  </label>
                </div>
              </fieldset>

              {captchaRequired && <div ref={captchaRef} />}

              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? 'Creating account…' : 'Create account'}
              </Button>

              <Text tone="muted" size="sm">
                By creating an account you agree to the <Link href="/terms">terms of service</Link>{' '}
                and <Link href="/privacy">privacy policy</Link>.
              </Text>
            </Stack>
          </form>
        </div>
      </div>
    </>
  )
}
