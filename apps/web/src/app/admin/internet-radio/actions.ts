// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { InternetRadioPreset } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader(): string {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

async function adminRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<{ error: string | null; data?: T }> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionHeader(),
      ...(init?.headers as Record<string, string> | undefined),
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { error?: string }).error ?? 'Request failed' }
  }
  if (res.status === 204) return { error: null }
  return { error: null, data: (await res.json()) as T }
}

export async function fetchAdminInternetRadioPresets(): Promise<{
  error: string | null
  presets: InternetRadioPreset[]
}> {
  const result = await adminRequest<{ presets: InternetRadioPreset[] }>(
    '/api/admin/internet-radio-presets',
  )
  return { error: result.error, presets: result.data?.presets ?? [] }
}

export async function createInternetRadioPreset(input: {
  name: string
  genre?: string
  description?: string
  iconUrl?: string
  programmingUrl?: string
  streamUrl?: string
}): Promise<{ error: string | null; preset?: InternetRadioPreset }> {
  return adminRequest<InternetRadioPreset>('/api/admin/internet-radio-presets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateInternetRadioPreset(
  id: string,
  patch: Record<string, string>,
): Promise<{ error: string | null; preset?: InternetRadioPreset }> {
  return adminRequest<InternetRadioPreset>(`/api/admin/internet-radio-presets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteInternetRadioPreset(id: string): Promise<{ error: string | null }> {
  return adminRequest(`/api/admin/internet-radio-presets/${id}`, { method: 'DELETE' })
}
