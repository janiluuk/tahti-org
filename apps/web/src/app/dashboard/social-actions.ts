// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export type SocialSettings = {
  mastodon: {
    connected: boolean
    accountLabel: string | null
    onReleasePublished: boolean
    onChannelLive: boolean
    postTemplate: string
  }
  bluesky: {
    connected: boolean
    accountLabel: string | null
    onReleasePublished: boolean
    onChannelLive: boolean
    postTemplate: string
  }
  twitter: {
    connected: boolean
    accountLabel: string | null
    onReleasePublished: boolean
    onChannelLive: boolean
    postTemplate: string
    configured: boolean
  }
  instagram: {
    connected: boolean
    accountLabel: string | null
    onReleasePublished: boolean
    onChannelLive: boolean
    postTemplate: string
    configured: boolean
  }
}

export async function saveMastodonSocial(input: {
  instanceUrl: string
  accessToken: string
  onReleasePublished: boolean
  onChannelLive: boolean
  postTemplate: string
}): Promise<{ error: string | null }> {
  const payload = {
    ...input,
    ...(input.accessToken ? { accessToken: input.accessToken } : {}),
  }
  if (!input.accessToken) delete (payload as { accessToken?: string }).accessToken

  const res = await fetch(`${apiUrl}/api/me/social/mastodon`, {
    method: 'PUT',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not save Mastodon settings' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function saveBlueskySocial(input: {
  handle: string
  appPassword: string
  onReleasePublished: boolean
  onChannelLive: boolean
  postTemplate: string
}): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {
    handle: input.handle,
    onReleasePublished: input.onReleasePublished,
    onChannelLive: input.onChannelLive,
    postTemplate: input.postTemplate,
  }
  if (input.appPassword) payload.appPassword = input.appPassword

  const res = await fetch(`${apiUrl}/api/me/social/bluesky`, {
    method: 'PUT',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not save Bluesky settings' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function disconnectMastodon(): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/mastodon`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Disconnect failed' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function disconnectBluesky(): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/bluesky`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Disconnect failed' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function postSocialManual(
  platform: 'MASTODON' | 'BLUESKY' | 'TWITTER' | 'INSTAGRAM',
  message: string,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/post`, {
    method: 'POST',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, message }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Post failed' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function saveTwitterSocial(input: {
  onReleasePublished: boolean
  onChannelLive: boolean
  postTemplate: string
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/twitter`, {
    method: 'PATCH',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not save Twitter settings' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function disconnectTwitter(): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/twitter`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Disconnect failed' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function saveInstagramSocial(input: {
  onReleasePublished: boolean
  onChannelLive: boolean
  postTemplate: string
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/instagram`, {
    method: 'PATCH',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not save Instagram settings' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function disconnectInstagram(): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/instagram`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Disconnect failed' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}
