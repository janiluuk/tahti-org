// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { FallbackMode } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export type ProgrammeItemRow = {
  id: string
  title: string
  status: string
  durationSec: number | null
  isFallback: boolean
  fallbackOrder: number | null
  lastFallbackPlayedAt: string | null
}

export type ProgrammeLibraryTrackRow = {
  releaseTrackId: string
  releaseId: string
  releaseTitle: string
  trackTitle: string
  durationSec: number | null
  archiveItemId: string | null
}

export type ProgrammeView = {
  fallbackMode: FallbackMode
  fallbackEnabled: boolean
  items: ProgrammeItemRow[]
  library: ProgrammeLibraryTrackRow[]
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

export async function fetchChannelProgramme(): Promise<{
  data: ProgrammeView | null
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/channel/programme`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  return parseProgrammeResponse(res)
}

export async function updateChannelProgramme(payload: {
  fallbackMode?: FallbackMode
  fallbackEnabled?: boolean
  items?: Array<{
    archiveItemId: string
    isFallback: boolean
    fallbackOrder?: number
  }>
}): Promise<{ data: ProgrammeView | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/programme`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  return parseProgrammeResponse(res)
}

export async function addLibraryTrackToRotation(
  releaseTrackId: string,
): Promise<{ data: ProgrammeView | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/programme/library`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ releaseTrackId }),
    cache: 'no-store',
  })
  return parseProgrammeResponse(res)
}
