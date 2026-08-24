// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import type { ThemeView } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

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

export async function fetchMyThemes(): Promise<{ error: string | null; themes: ThemeView[] }> {
  const result = await request<{ themes: ThemeView[] }>('/api/me/themes')
  return { error: result.error, themes: result.data?.themes ?? [] }
}

export async function createMyTheme(input: {
  name: string
  vars: Record<string, string>
  dark: Record<string, string>
}): Promise<{ error: string | null; theme?: ThemeView }> {
  return request<ThemeView>('/api/me/themes', { method: 'POST', body: JSON.stringify(input) })
}

export async function patchMyTheme(
  id: string,
  patch: Record<string, unknown>,
): Promise<{ error: string | null; theme?: ThemeView }> {
  return request<ThemeView>(`/api/me/themes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteMyTheme(id: string): Promise<{ error: string | null }> {
  return request(`/api/me/themes/${id}`, { method: 'DELETE' })
}

export async function submitMyThemePublic(
  id: string,
): Promise<{ error: string | null; theme?: ThemeView }> {
  return request<ThemeView>(`/api/me/themes/${id}/submit-public`, { method: 'POST' })
}
