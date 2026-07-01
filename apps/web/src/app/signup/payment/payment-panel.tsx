// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Alert, BrandLogo, Button, ButtonIcon, Heading, Stack, Text } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { SIGNUP_TIER_KEY, type SignupTier } from '@/lib/signup'
import { startSignupMembershipCheckout } from '../actions'
import { SignupWizard } from '../signup-wizard'

export function SignupPaymentPanel({
  isMember,
  emailVerified,
}: {
  isMember: boolean
  emailVerified: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tier, setTier] = useState<SignupTier>('free')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const stored = sessionStorage.getItem(SIGNUP_TIER_KEY)
    if (stored === 'member' || stored === 'paid' || stored === 'free') {
      setTier(stored === 'paid' ? 'member' : (stored as SignupTier))
    }
  }, [])

  useEffect(() => {
    const status = searchParams.get('membership')
    if (status === 'canceled') {
      setMessage('Payment canceled — you can try again or continue on the free tier.')
    }
  }, [searchParams])

  function continueToProfile() {
    router.push('/signup/profile')
  }

  function payMembership() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await startSignupMembershipCheckout()
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl
        return
      }
      if (res.activated) {
        setMessage(`Membership activated — member #${res.memberNumber}.`)
        router.push('/signup/profile?membership=success')
      }
    })
  }

  const memberSelected = tier === 'member'
  const membershipComplete = memberSelected && isMember

  return (
    <>
      <BgCanvas variant="subtle" />
      <div className="auth-shell">
        <div className="auth-card auth-card--dark auth-card--wide">
          <BrandLogo />
          <SignupWizard current="payment" />
          <Heading level={1}>Membership</Heading>

          {!emailVerified && (
            <Alert variant="error">
              Verify your email before continuing. Check your inbox for the verification link, then
              sign in again.
            </Alert>
          )}

          {memberSelected ? (
            <>
              <Text tone="muted">
                Tahti ry membership is <strong>€40/year</strong> — financial support for the
                cooperative, plus FLAC lossless streaming, Stash file storage, and a vote at the
                AGM.
              </Text>
              {membershipComplete ? (
                <Alert variant="success">
                  Your membership is active. Continue to set up your profile.
                </Alert>
              ) : (
                <Text tone="muted" size="sm">
                  Complete payment via Stripe to activate your membership.
                </Text>
              )}
            </>
          ) : (
            <Text tone="muted">
              You selected the <strong>free tier</strong> — MP3 streaming, smart links, newsletter,
              analytics, fan-subs, and grant eligibility. No payment required.
            </Text>
          )}

          {message && <Alert variant="info">{message}</Alert>}
          {error && <Alert variant="error">{error}</Alert>}

          <Stack gap={3}>
            {memberSelected && !membershipComplete ? (
              <>
                <Button
                  variant="primary"
                  disabled={!emailVerified || isPending}
                  onClick={payMembership}
                >
                  <ButtonIcon name="check" />
                  {isPending ? 'Starting checkout…' : 'Pay €40/year via Stripe'}
                </Button>
                <Button variant="ghost" onClick={continueToProfile} disabled={isPending}>
                  Skip for now — continue as free tier →
                </Button>
              </>
            ) : (
              <Button variant="primary" disabled={!emailVerified} onClick={continueToProfile}>
                <ButtonIcon name="arrowRight" />
                Continue to profile
              </Button>
            )}

            <Text tone="muted" size="sm">
              <Link href="/signup">← Back to account</Link>
            </Text>
          </Stack>
        </div>
      </div>
    </>
  )
}
