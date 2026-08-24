// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { AdminThemeView, ThemeVisibilityInput } from '@tahti/shared'

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
  return { error: null, data: (await res.json()) as T }
}

export async function fetchAdminThemes(
  visibility?: ThemeVisibilityInput,
): Promise<{ error: string | null; themes: AdminThemeView[] }> {
  const qs = visibility ? `?visibility=${visibility}` : ''
  const result = await adminRequest<{ themes: AdminThemeView[] }>(`/api/admin/themes${qs}`)
  return { error: result.error, themes: result.data?.themes ?? [] }
}

export async function approveTheme(
  id: string,
): Promise<{ error: string | null; theme?: AdminThemeView }> {
  return adminRequest<AdminThemeView>(`/api/admin/themes/${id}/approve`, { method: 'POST' })
}

export async function rejectTheme(
  id: string,
  moderationNote: string,
): Promise<{ error: string | null; theme?: AdminThemeView }> {
  return adminRequest<AdminThemeView>(`/api/admin/themes/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ moderationNote }),
  })
}
