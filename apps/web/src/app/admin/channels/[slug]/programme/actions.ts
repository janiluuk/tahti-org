// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { FallbackMode } from '@tahti/shared'
import type { ProgrammeView } from '../../../../dashboard/programme-actions'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

async function parseProgrammeResponse(
  res: Response,
): Promise<{ data: ProgrammeView | null; error: string | null }> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { data: null, error: (data as { error?: string }).error ?? 'Failed to load rotation' }
  }
  return { data: (await res.json()) as ProgrammeView, error: null }
}

/** Board-only equivalent of dashboard/programme-actions.ts, scoped by :slug
 * instead of the session user — same three endpoints, admin-side. */
export async function fetchAdminChannelProgramme(
  slug: string,
): Promise<{ data: ProgrammeView | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/channels/${slug}/programme`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  return parseProgrammeResponse(res)
}

export async function updateAdminChannelProgramme(
  slug: string,
  payload: {
    fallbackMode?: FallbackMode
    fallbackEnabled?: boolean
    items?: Array<{ archiveItemId: string; isFallback: boolean; fallbackOrder?: number }>
  },
): Promise<{ data: ProgrammeView | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/channels/${slug}/programme`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  return parseProgrammeResponse(res)
}

export async function addAdminLibraryTrack(
  slug: string,
  releaseTrackId: string,
): Promise<{ data: ProgrammeView | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/channels/${slug}/programme/library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ releaseTrackId }),
    cache: 'no-store',
  })
  return parseProgrammeResponse(res)
}
