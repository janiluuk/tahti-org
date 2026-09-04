// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import type { InternetRadioPreset, InternetRadioStation } from '@tahti/shared'
import { resolveServerApiUrl } from '@/lib/api-url'

const apiUrl = resolveServerApiUrl()

function sessionHeader(): string {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

async function request<T>(
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

export async function fetchInternetRadioPresets(): Promise<{
  error: string | null
  presets: InternetRadioPreset[]
}> {
  const result = await request<{ presets: InternetRadioPreset[] }>('/api/internet-radio/presets')
  return { error: result.error, presets: result.data?.presets ?? [] }
}

export async function fetchMyInternetRadioStations(): Promise<{
  error: string | null
  stations: InternetRadioStation[]
}> {
  const result = await request<{ stations: InternetRadioStation[] }>('/api/me/internet-radio')
  return { error: result.error, stations: result.data?.stations ?? [] }
}

export async function addMyInternetRadioStation(
  input: Record<string, unknown>,
): Promise<{ error: string | null; station?: InternetRadioStation }> {
  return request<InternetRadioStation>('/api/me/internet-radio', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function patchMyInternetRadioStation(
  id: string,
  patch: Record<string, unknown>,
): Promise<{ error: string | null; station?: InternetRadioStation }> {
  return request<InternetRadioStation>(`/api/me/internet-radio/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteMyInternetRadioStation(id: string): Promise<{ error: string | null }> {
  return request(`/api/me/internet-radio/${id}`, { method: 'DELETE' })
}
