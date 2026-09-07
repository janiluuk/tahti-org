// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Thin server-side fetch helpers shared by every Disco-widgets scope's
// actions file (dashboard/disco-widgets-actions.ts, channel-disco-widgets-
// actions.ts, admin/disco-widgets/actions.ts). Not itself a 'use server' file
// — a 'use server' file may only export async functions, so each scope wraps
// these in its own thin named actions instead.

import { cookies } from 'next/headers'
import type {
  DiscoWidgetAdminItem,
  DiscoWidgetInstallView,
  DiscoWidgetStoreItem,
} from '@tahti/shared'

/** configJson is a free-form JSON object — the SDK's per-widget settings blob,
 * no fixed schema on this side (see packages/widget-sdk). */
export type DiscoWidgetConfig = Record<string, unknown>

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

export async function fetchDiscoWidgetStore(
  scope: 'LISTENER' | 'ARTIST',
): Promise<{ error: string | null; widgets: DiscoWidgetStoreItem[] }> {
  const result = await request<{ widgets: DiscoWidgetStoreItem[] }>(
    `/api/disco-widgets/store?scope=${scope}`,
  )
  return { error: result.error, widgets: result.data?.widgets ?? [] }
}

export async function fetchDiscoWidgetInstalls(
  basePath: string,
): Promise<{ error: string | null; installs: DiscoWidgetInstallView[] }> {
  const result = await request<{ installs: DiscoWidgetInstallView[] }>(basePath)
  return { error: result.error, installs: result.data?.installs ?? [] }
}

export async function createDiscoWidgetInstall(
  basePath: string,
  widgetId: string,
): Promise<{ error: string | null; install?: DiscoWidgetInstallView }> {
  return request<DiscoWidgetInstallView>(basePath, {
    method: 'POST',
    body: JSON.stringify({ widgetId }),
  })
}

export async function patchDiscoWidgetInstall(
  basePath: string,
  id: string,
  patch: { enabled?: boolean; position?: number; configJson?: DiscoWidgetConfig },
): Promise<{ error: string | null; install?: DiscoWidgetInstallView }> {
  return request<DiscoWidgetInstallView>(`${basePath}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteDiscoWidgetInstall(
  basePath: string,
  id: string,
): Promise<{ error: string | null }> {
  return request(`${basePath}/${id}`, { method: 'DELETE' })
}

/** Board-only — sets or clears (pass null) the configJson every new install
 * of this widget seeds from, regardless of which scope creates it. */
export async function setDiscoWidgetDefaultConfig(
  widgetId: string,
  defaultConfigJson: DiscoWidgetConfig | null,
): Promise<{ error: string | null; widget?: DiscoWidgetAdminItem }> {
  return request<DiscoWidgetAdminItem>(`/api/admin/disco-widgets/${widgetId}/default-config`, {
    method: 'POST',
    body: JSON.stringify({ defaultConfigJson }),
  })
}
