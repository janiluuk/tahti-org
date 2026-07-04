// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidateTag } from 'next/cache'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function prepareUpload(params: {
  title: string
  filename: string
  contentType: string
  fileSizeBytes: number
}): Promise<{ uploadId: string; uploadUrl: string; expiresAt: string }> {
  const response = await fetch(`${apiUrl}/api/uploads/prepare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionHeader(),
    },
    body: JSON.stringify(params),
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to prepare upload')
  }

  return response.json()
}

export async function completeUpload(params: {
  uploadId: string
  etag: string
  title: string
  metadata?: Record<string, unknown>
}): Promise<{ itemId: string; status: string }> {
  const response = await fetch(`${apiUrl}/api/uploads/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionHeader(),
    },
    body: JSON.stringify(params),
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to complete upload')
  }

  return response.json()
}

export async function getArchiveItemStatus(
  itemId: string,
): Promise<{ status: string; title: string }> {
  const response = await fetch(`${apiUrl}/api/me/archive/${itemId}`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to load archive status')
  }
  const data = (await response.json()) as { status: string; title: string }
  return { status: data.status, title: data.title }
}

export async function postAnnouncement(
  body: string,
): Promise<{ error: string | null; id?: string }> {
  const response = await fetch(`${apiUrl}/api/me/chat/announcements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ body }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to post' }
  }
  const data = (await response.json()) as { id: string }
  return { error: null, id: data.id }
}

export async function deleteAnnouncement(id: string): Promise<{ error: string | null }> {
  const response = await fetch(`${apiUrl}/api/me/chat/announcements/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!response.ok && response.status !== 204) {
    return { error: 'Failed to delete' }
  }
  return { error: null }
}

export async function createFanTier(params: {
  name: string
  amountCents: number
  description?: string
  perks?: string[]
}): Promise<{ error: string | null }> {
  const response = await fetch(`${apiUrl}/api/me/fan-tiers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to create tier' }
  }
  return { error: null }
}

export async function startMembershipPortal(): Promise<{
  error: string | null
  portalUrl?: string
}> {
  const response = await fetch(`${apiUrl}/api/me/membership/portal`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: (data as { error?: string }).error ?? 'Could not open billing portal' }
  }
  return { error: null, portalUrl: (data as { portalUrl?: string }).portalUrl }
}

export async function startMembershipCheckout(): Promise<{
  error: string | null
  checkoutUrl?: string
  activated?: boolean
  memberNumber?: number
}> {
  const response = await fetch(`${apiUrl}/api/me/membership/checkout`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
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

export async function setFanTierActive(
  id: string,
  active: boolean,
): Promise<{ error: string | null }> {
  const response = await fetch(`${apiUrl}/api/me/fan-tiers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ active }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to update tier' }
  }
  return { error: null }
}

export async function startFanSubConnectOnboarding(): Promise<{
  error: string | null
  onboardingUrl?: string
}> {
  const response = await fetch(`${apiUrl}/api/me/fan-subs/connect/onboard`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: (data as { error?: string }).error ?? 'Could not start onboarding' }
  }
  return { error: null, onboardingUrl: (data as { onboardingUrl?: string }).onboardingUrl }
}

export async function openFanSubConnectPortal(): Promise<{
  error: string | null
  url?: string
}> {
  const response = await fetch(`${apiUrl}/api/me/fan-subs/connect/portal`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: (data as { error?: string }).error ?? 'Could not open Stripe account' }
  }
  return { error: null, url: (data as { url?: string }).url }
}

export async function createNewsletterDraft(params: {
  subject: string
  bodyMd: string
  subscribersOnly?: boolean
}): Promise<{
  error: string | null
  draft?: {
    id: string
    subject: string
    state: string
    sentAt: string | null
    createdAt: string
    subscribersOnly: boolean
    _count: { sends: number }
  }
}> {
  const response = await fetch(`${apiUrl}/api/me/newsletter/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to save draft' }
  }
  const draft = data as {
    id: string
    subject: string
    state: string
    sentAt: string | null
    createdAt: string
    subscribersOnly: boolean
  }
  return {
    error: null,
    draft: { ...draft, _count: { sends: 0 } },
  }
}

export async function sendNewsletterDraft(params: {
  draftId: string
  audience: 'all' | 'fans'
}): Promise<{ error: string | null; queued?: number; audience?: string }> {
  const body = params.audience === 'fans' ? { audience: 'fans' } : {}
  const response = await fetch(`${apiUrl}/api/me/newsletter/send/${params.draftId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to send newsletter' }
  }
  return {
    error: null,
    queued: (data as { queued?: number }).queued,
    audience: (data as { audience?: string }).audience,
  }
}

export async function endBroadcast(): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${apiUrl}/api/me/channel/end-broadcast`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { ok: false, error: (data as { error?: string }).error ?? 'Failed to end broadcast' }
  }
  // Listeners on /listen and the homepage should stop seeing this channel as live
  // immediately, not after the up-to-30s time-based ISR window.
  revalidateTag('channels-live')
  return { ok: true }
}

export async function goLive(): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${apiUrl}/api/me/channel/go-live`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { ok: false, error: (data as { error?: string }).error ?? 'Failed to go live' }
  }
  // Listeners on /listen and the homepage should see this channel as live
  // immediately, not after the up-to-30s time-based ISR window.
  revalidateTag('channels-live')
  return { ok: true }
}
