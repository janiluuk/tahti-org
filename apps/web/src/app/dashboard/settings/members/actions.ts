// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { ChannelMemberView } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function fetchMyMembers(): Promise<ChannelMemberView[]> {
  const res = await fetch(`${apiUrl}/api/me/channel/members`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return (await res.json()) as ChannelMemberView[]
}

export async function createMember(
  name: string,
  role: string,
): Promise<{ error: string | null; member?: ChannelMemberView }> {
  const res = await fetch(`${apiUrl}/api/me/channel/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ name, role }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { error: (data as { error?: string }).error ?? 'Failed to add member' }
  revalidatePath('/dashboard/settings/members')
  return { error: null, member: data as ChannelMemberView }
}

export async function updateMember(
  id: string,
  patch: { name?: string; role?: string },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/members/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(patch),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to update member' }
  }
  revalidatePath('/dashboard/settings/members')
  return { error: null }
}

export async function deleteMember(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/members/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to remove member' }
  }
  revalidatePath('/dashboard/settings/members')
  return { error: null }
}

export async function reorderMembers(ids: string[]): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/members/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ ids }),
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to reorder' }
  }
  revalidatePath('/dashboard/settings/members')
  return { error: null }
}

export async function prepareMemberPicture(
  id: string,
  filename: string,
  contentType: string,
): Promise<{ error: string | null; uploadKey?: string; uploadUrl?: string }> {
  const res = await fetch(`${apiUrl}/api/me/channel/members/${id}/picture/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ filename, contentType }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to prepare upload' }
  }
  const body = data as { uploadKey: string; uploadUrl: string }
  return { error: null, uploadKey: body.uploadKey, uploadUrl: body.uploadUrl }
}

export async function completeMemberPicture(
  id: string,
  uploadKey: string,
): Promise<{ error: string | null; url?: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/members/${id}/picture/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ uploadKey }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { error: (data as { error?: string }).error ?? 'Failed to attach picture' }
  revalidatePath('/dashboard/settings/members')
  return { error: null, url: (data as { url: string | null }).url }
}

export async function memberPictureFromUrl(
  id: string,
  sourceUrl: string,
): Promise<{ error: string | null; url?: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/members/${id}/picture/from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ sourceUrl }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { error: (data as { error?: string }).error ?? 'Failed to fetch image' }
  revalidatePath('/dashboard/settings/members')
  return { error: null, url: (data as { url: string | null }).url }
}
