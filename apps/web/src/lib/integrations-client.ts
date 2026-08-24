// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export interface IntegrationView {
  slug: string
  name: string
  description: string
  scope: 'IMPORT' | 'EXPORT' | 'FINGERPRINT'
  authKind: 'API_KEY' | 'OAUTH'
  installed: boolean
  connected: boolean
}

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

export async function fetchMyIntegrations(): Promise<{
  error: string | null
  integrations: IntegrationView[]
}> {
  const result = await request<{ integrations: IntegrationView[] }>('/api/me/integrations')
  return { error: result.error, integrations: result.data?.integrations ?? [] }
}

export async function installMyIntegration(
  slug: string,
  fields: Record<string, string>,
): Promise<{ error: string | null }> {
  return request(`/api/me/integrations/${slug}/install`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  })
}

export async function removeMyIntegration(slug: string): Promise<{ error: string | null }> {
  return request(`/api/me/integrations/${slug}`, { method: 'DELETE' })
}
