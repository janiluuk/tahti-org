// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { ChannelVisualPatch, ReleaseVisualPatch, ArchiveItemVisualPatch } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const s = cookieStore.get('tahti_session')
  return s ? `tahti_session=${s.value}` : ''
}

export async function updateChannelVisual(patch: ChannelVisualPatch): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/visual`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(patch),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: body.error ?? 'Failed to save visual settings' }
  }
  return { error: null }
}

export async function updateReleaseVisual(releaseId: string, patch: ReleaseVisualPatch): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${releaseId}/visual`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(patch),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: body.error ?? 'Failed to save visual settings' }
  }
  return { error: null }
}

export async function updateArchiveItemVisual(itemId: string, patch: ArchiveItemVisualPatch): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/visual`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(patch),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: body.error ?? 'Failed to save visual settings' }
  }
  return { error: null }
}
