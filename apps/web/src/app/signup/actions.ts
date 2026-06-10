// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { ProfilePatchSchema } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function updateSignupProfile(input: {
  displayName?: string
  bio?: string
  avatarUrl?: string
  countryCode?: string | null
  genreTags?: string
  website?: string
  soundcloud?: string
  bandcamp?: string
}): Promise<{ error: string | null }> {
  const socialLinks: Record<string, string> = {}
  if (input.website?.trim()) socialLinks.website = input.website.trim()
  if (input.soundcloud?.trim()) socialLinks.soundcloud = input.soundcloud.trim()
  if (input.bandcamp?.trim()) socialLinks.bandcamp = input.bandcamp.trim()
  if (input.genreTags?.trim()) socialLinks.genres = input.genreTags.trim()

  const body = {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
    ...(Object.keys(socialLinks).length > 0 ? { socialLinks } : {}),
  }

  const parsed = ProfilePatchSchema.safeParse(body)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid profile data' }
  }

  const response = await fetch(`${apiUrl}/api/me/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionHeader(),
    },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not save profile' }
  }

  return { error: null }
}

export async function startSignupMembershipCheckout(): Promise<{
  error: string | null
  checkoutUrl?: string
  activated?: boolean
  memberNumber?: number
}> {
  const response = await fetch(`${apiUrl}/api/me/membership/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionHeader(),
    },
    body: JSON.stringify({
      successPath: '/signup/profile?membership=success',
      cancelPath: '/signup/payment?membership=canceled',
    }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: (data as { error?: string }).error ?? 'Checkout failed' }
  }
  return {
    error: null,
    checkoutUrl: (data as { checkoutUrl?: string }).checkoutUrl,
    activated: (data as { activated?: boolean }).activated,
    memberNumber: (data as { memberNumber?: number }).memberNumber,
  }
}

export async function fetchSignupMembershipStatus(): Promise<{
  isMember: boolean
  emailVerified: boolean
  status: string
} | null> {
  const response = await fetch(`${apiUrl}/api/me/membership`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!response.ok) return null
  const data = (await response.json()) as {
    isMember: boolean
    emailVerified: boolean
    status: string
  }
  return data
}
