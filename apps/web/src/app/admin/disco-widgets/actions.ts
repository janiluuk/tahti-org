// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type {
  DiscoWidgetAdminItem,
  DiscoWidgetInstallView,
  DiscoWidgetScopeInput,
  DiscoWidgetStatusInput,
} from '@tahti/shared'
import {
  deleteDiscoWidgetInstall,
  fetchDiscoWidgetInstalls,
  patchDiscoWidgetInstall,
} from '@/lib/disco-widgets-client'

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

export async function fetchDiscoWidgetCatalog(
  scope?: DiscoWidgetScopeInput,
  status?: DiscoWidgetStatusInput,
): Promise<{ error: string | null; widgets: DiscoWidgetAdminItem[] }> {
  const qs = new URLSearchParams({
    ...(scope ? { scope } : {}),
    ...(status ? { status } : {}),
  })
  const result = await adminRequest<{ widgets: DiscoWidgetAdminItem[] }>(
    `/api/admin/disco-widgets?${qs}`,
  )
  return { error: result.error, widgets: result.data?.widgets ?? [] }
}

export async function registerDiscoWidget(input: {
  slug: string
  scope: DiscoWidgetScopeInput
  name: string
  description: string
  authorName: string
  categories: string[]
}): Promise<{ error: string | null; widget?: DiscoWidgetAdminItem }> {
  return adminRequest<DiscoWidgetAdminItem>('/api/admin/disco-widgets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function prepareDiscoWidgetUpload(
  widgetId: string,
  version: string,
  fileSizeBytes: number,
): Promise<{ error: string | null; uploadUrl?: string; bundleKey?: string }> {
  const result = await adminRequest<{ uploadUrl: string; bundleKey: string }>(
    `/api/admin/disco-widgets/${widgetId}/prepare-upload`,
    { method: 'POST', body: JSON.stringify({ version, fileSizeBytes }) },
  )
  return {
    error: result.error,
    uploadUrl: result.data?.uploadUrl,
    bundleKey: result.data?.bundleKey,
  }
}

export async function publishDiscoWidgetVersion(
  widgetId: string,
  version: string,
  changelog?: string,
): Promise<{ error: string | null; widget?: DiscoWidgetAdminItem }> {
  return adminRequest<DiscoWidgetAdminItem>(
    `/api/admin/disco-widgets/${widgetId}/publish-version`,
    {
      method: 'POST',
      body: JSON.stringify({ version, changelog }),
    },
  )
}

export async function approveDiscoWidget(
  widgetId: string,
): Promise<{ error: string | null; widget?: DiscoWidgetAdminItem }> {
  return adminRequest<DiscoWidgetAdminItem>(`/api/admin/disco-widgets/${widgetId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function rejectDiscoWidget(
  widgetId: string,
  moderationNote: string,
): Promise<{ error: string | null; widget?: DiscoWidgetAdminItem }> {
  return adminRequest<DiscoWidgetAdminItem>(`/api/admin/disco-widgets/${widgetId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ moderationNote }),
  })
}

export async function disableDiscoWidget(
  widgetId: string,
): Promise<{ error: string | null; widget?: DiscoWidgetAdminItem }> {
  return adminRequest<DiscoWidgetAdminItem>(`/api/admin/disco-widgets/${widgetId}/disable`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ── Homepage (ADMIN-scope) installs ─────────────────────────────────────────

const HOMEPAGE_INSTALLS_PATH = '/api/admin/disco-widgets/installs?surface=homepage'

export async function listHomepageDiscoWidgetInstalls(): Promise<{
  error: string | null
  installs: DiscoWidgetInstallView[]
}> {
  return fetchDiscoWidgetInstalls(HOMEPAGE_INSTALLS_PATH)
}

export async function installHomepageDiscoWidget(
  widgetId: string,
): Promise<{ error: string | null; install?: DiscoWidgetInstallView }> {
  return adminRequest<DiscoWidgetInstallView>('/api/admin/disco-widgets/installs', {
    method: 'POST',
    body: JSON.stringify({ widgetId, surface: 'homepage' }),
  })
}

export async function patchHomepageDiscoWidgetInstall(
  id: string,
  patch: { enabled?: boolean; position?: number },
): Promise<{ error: string | null; install?: DiscoWidgetInstallView }> {
  return patchDiscoWidgetInstall('/api/admin/disco-widgets/installs', id, patch)
}

export async function removeHomepageDiscoWidgetInstall(
  id: string,
): Promise<{ error: string | null }> {
  return deleteDiscoWidgetInstall('/api/admin/disco-widgets/installs', id)
}
