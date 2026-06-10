// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export const SIGNUP_TIER_KEY = 'tahti_signup_tier'

export type SignupTier = 'free' | 'paid'

export const SIGNUP_STEPS = [
  { id: 'account', label: 'Account', href: '/signup' },
  { id: 'payment', label: 'Membership', href: '/signup/payment' },
  { id: 'profile', label: 'Profile', href: '/signup/profile' },
  { id: 'broadcast', label: 'Broadcast', href: '/signup/broadcast' },
] as const

export type SignupStepId = (typeof SIGNUP_STEPS)[number]['id']

/** When true, `/signup` shows the self-serve wizard instead of the closed-beta card. */
export function isSignupOpen(): boolean {
  const flag = process.env.SIGNUP_OPEN
  if (flag === '1' || flag === 'true') return true
  if (flag === '0' || flag === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

export function safeSignupRedirect(path: string | null | undefined, fallback: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback
  if (!path.startsWith('/signup') && !path.startsWith('/dashboard')) return fallback
  return path
}
