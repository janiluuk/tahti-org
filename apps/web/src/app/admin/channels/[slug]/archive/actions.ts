// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export type AdminArchiveItem = Record<string, unknown> & {
  id: string
  title: string
  status: string
}

/** Board-only equivalent of dashboard's GET /api/me/archive, scoped by :slug
 * instead of the session user. */
export async function fetchAdminChannelArchive(
  slug: string,
): Promise<{ data: AdminArchiveItem[] | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/channels/${slug}/archive`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { data: null, error: (data as { error?: string }).error ?? 'Failed to load archive' }
  }
  return { data: (await res.json()) as AdminArchiveItem[], error: null }
}

/** Board-only equivalent of dashboard's PATCH /api/me/archive/:id, scoped by
 * :slug + :itemId instead of the session user owning the item. */
export async function updateAdminArchiveMetadata(
  slug: string,
  itemId: string,
  payload: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/channels/${slug}/archive/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save metadata' }
  }
  return { error: null }
}
