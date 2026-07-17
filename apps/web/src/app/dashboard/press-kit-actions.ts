// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { PressKitImageItem } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function preparePressKitImageUpload(
  filename: string,
  contentType: string,
): Promise<{ error: string | null; uploadKey?: string; uploadUrl?: string }> {
  const res = await fetch(`${apiUrl}/api/me/press-kit/images/prepare`, {
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

export async function completePressKitImageUpload(
  uploadKey: string,
): Promise<{ error: string | null; image?: PressKitImageItem }> {
  const res = await fetch(`${apiUrl}/api/me/press-kit/images/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ uploadKey }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to save image' }
  }
  revalidatePath('/dashboard/settings/account')
  return { error: null, image: data as PressKitImageItem }
}

export async function updatePressKitImage(
  id: string,
  params: { title?: string | null; includeInZip?: boolean },
): Promise<{ error: string | null; image?: PressKitImageItem }> {
  const res = await fetch(`${apiUrl}/api/me/press-kit/images/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to update image' }
  }
  revalidatePath('/dashboard/settings/account')
  return { error: null, image: data as PressKitImageItem }
}

export async function deletePressKitImage(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/press-kit/images/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to delete image' }
  }
  revalidatePath('/dashboard/settings/account')
  return { error: null }
}

export async function updatePressKitGallerySettings(
  pressKitGalleryPublic: boolean,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/press-kit/gallery-settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ pressKitGalleryPublic }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to update gallery setting' }
  }
  revalidatePath('/dashboard/settings/account')
  return { error: null }
}
