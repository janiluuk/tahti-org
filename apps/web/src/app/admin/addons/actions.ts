// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type {
  AddonAdminItem,
  AddonInstallView,
  AddonScopeInput,
  AddonStatusInput,
} from '@tahti/shared'
import {
  deleteAddonInstall,
  fetchAddonInstalls,
  patchAddonInstall,
  setAddonDefaultConfig,
  setAddonEnabledByDefault,
  type AddonConfig,
} from '@/lib/addons-client'

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

export async function fetchAddonCatalog(
  scope?: AddonScopeInput,
  status?: AddonStatusInput,
): Promise<{ error: string | null; widgets: AddonAdminItem[] }> {
  const qs = new URLSearchParams({
    ...(scope ? { scope } : {}),
    ...(status ? { status } : {}),
  })
  const result = await adminRequest<{ widgets: AddonAdminItem[] }>(`/api/admin/addons?${qs}`)
  return { error: result.error, widgets: result.data?.widgets ?? [] }
}

export async function registerAddon(input: {
  slug: string
  scope: AddonScopeInput
  name: string
  description: string
  authorName: string
  categories: string[]
}): Promise<{ error: string | null; widget?: AddonAdminItem }> {
  return adminRequest<AddonAdminItem>('/api/admin/addons', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function prepareAddonUpload(
  widgetId: string,
  version: string,
  fileSizeBytes: number,
): Promise<{ error: string | null; uploadUrl?: string; bundleKey?: string }> {
  const result = await adminRequest<{ uploadUrl: string; bundleKey: string }>(
    `/api/admin/addons/${widgetId}/prepare-upload`,
    { method: 'POST', body: JSON.stringify({ version, fileSizeBytes }) },
  )
  return {
    error: result.error,
    uploadUrl: result.data?.uploadUrl,
    bundleKey: result.data?.bundleKey,
  }
}

export async function publishAddonVersion(
  widgetId: string,
  version: string,
  changelog?: string,
): Promise<{ error: string | null; widget?: AddonAdminItem }> {
  return adminRequest<AddonAdminItem>(`/api/admin/addons/${widgetId}/publish-version`, {
    method: 'POST',
    body: JSON.stringify({ version, changelog }),
  })
}

export async function approveAddon(
  widgetId: string,
): Promise<{ error: string | null; widget?: AddonAdminItem }> {
  return adminRequest<AddonAdminItem>(`/api/admin/addons/${widgetId}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function rejectAddon(
  widgetId: string,
  moderationNote: string,
): Promise<{ error: string | null; widget?: AddonAdminItem }> {
  return adminRequest<AddonAdminItem>(`/api/admin/addons/${widgetId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ moderationNote }),
  })
}

export async function disableAddon(
  widgetId: string,
): Promise<{ error: string | null; widget?: AddonAdminItem }> {
  return adminRequest<AddonAdminItem>(`/api/admin/addons/${widgetId}/disable`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ── Homepage (ADMIN-scope) installs ─────────────────────────────────────────

const HOMEPAGE_INSTALLS_PATH = '/api/admin/addons/installs?surface=homepage'

export async function listHomepageAddonInstalls(): Promise<{
  error: string | null
  installs: AddonInstallView[]
}> {
  return fetchAddonInstalls(HOMEPAGE_INSTALLS_PATH)
}

export async function installHomepageAddon(
  widgetId: string,
): Promise<{ error: string | null; install?: AddonInstallView }> {
  return adminRequest<AddonInstallView>('/api/admin/addons/installs', {
    method: 'POST',
    body: JSON.stringify({ widgetId, surface: 'homepage' }),
  })
}

export async function patchHomepageAddonInstall(
  id: string,
  patch: { enabled?: boolean; position?: number; configJson?: AddonConfig },
): Promise<{ error: string | null; install?: AddonInstallView }> {
  return patchAddonInstall('/api/admin/addons/installs', id, patch)
}

export async function removeHomepageAddonInstall(id: string): Promise<{ error: string | null }> {
  return deleteAddonInstall('/api/admin/addons/installs', id)
}

/** Board-only: promotes this widget's current per-install configJson to be
 * the starting config for every future install, across all scopes. */
export async function saveAddonDefaultConfig(
  widgetId: string,
  defaultConfigJson: AddonConfig,
): Promise<{ error: string | null; widget?: AddonAdminItem }> {
  return setAddonDefaultConfig(widgetId, defaultConfigJson)
}

/** Board-only: platform-wide "on by default" for every owner with no install
 * row of their own — see resolveAddonRenderSet (apps/api). */
export async function setAddonEnabledByDefaultAction(
  widgetId: string,
  enabledByDefault: boolean,
): Promise<{ error: string | null; widget?: AddonAdminItem }> {
  return setAddonEnabledByDefault(widgetId, enabledByDefault)
}
