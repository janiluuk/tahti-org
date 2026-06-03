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

export async function fetchChannelProgramme(): Promise<{
  fallbackMode: FallbackMode
  items: ProgrammeItemRow[]
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/channel/programme`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return {
      fallbackMode: 'shuffle',
      items: [],
      error: (data as { error?: string }).error ?? 'Failed to load programme',
    }
  }
  const data = (await res.json()) as {
    fallbackMode: FallbackMode
    items: ProgrammeItemRow[]
  }
  return { fallbackMode: data.fallbackMode, items: data.items, error: null }
}

export async function updateChannelProgramme(payload: {
  fallbackMode?: FallbackMode
  items?: Array<{
    archiveItemId: string
    isFallback: boolean
    fallbackOrder?: number
  }>
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/programme`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save programme' }
  }
  return { error: null }
}
