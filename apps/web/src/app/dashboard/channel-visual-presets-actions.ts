// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { ChannelVisualPresetDto } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const s = cookieStore.get('tahti_session')
  return s ? `tahti_session=${s.value}` : ''
}

export async function listChannelVisualPresets(): Promise<{
  presets: ChannelVisualPresetDto[]
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/channel/visual-presets`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { presets: [], error: body.error ?? 'Failed to load saved Looks' }
  }
  const presets = (await res.json()) as ChannelVisualPresetDto[]
  return { presets, error: null }
}

export async function saveChannelVisualPreset(
  name: string,
  settings: Record<string, unknown>,
): Promise<{ preset: ChannelVisualPresetDto | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/visual-presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ name, settings }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { preset: null, error: body.error ?? 'Failed to save Look' }
  }
  const preset = (await res.json()) as ChannelVisualPresetDto
  return { preset, error: null }
}

export async function deleteChannelVisualPreset(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/channel/visual-presets/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: body.error ?? 'Failed to delete Look' }
  }
  return { error: null }
}
