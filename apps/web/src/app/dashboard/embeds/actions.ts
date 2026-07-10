// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { ArtistEmbedView } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function createEmbed(
  url: string,
): Promise<{ error: string | null; embed?: ArtistEmbedView }> {
  const res = await fetch(`${apiUrl}/api/me/embeds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ url }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to add embed' }
  }
  revalidatePath('/dashboard/embeds')
  return { error: null, embed: data as ArtistEmbedView }
}

export async function deleteEmbed(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/embeds/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to remove embed' }
  }
  revalidatePath('/dashboard/embeds')
  return { error: null }
}
