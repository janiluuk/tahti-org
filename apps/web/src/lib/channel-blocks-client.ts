// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Thin server-side fetch helpers for the Channel Designer's "Brand blocks"
// section (apps/web/src/app/dashboard/channel/channel-blocks-actions.ts).
// Same request()/error shape as lib/addons-client.ts -- not shared with it
// since each domain's actions file wraps its own copy (see that file's
// header comment for why).

import { cookies } from 'next/headers'
import type { ChannelBlockView } from '@tahti/shared'

const BLOCKS_PATH = '/api/me/channel/blocks'

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

export async function fetchChannelBlocks(): Promise<{
  error: string | null
  blocks: ChannelBlockView[]
}> {
  const result = await request<{ blocks: ChannelBlockView[] }>(BLOCKS_PATH)
  return { error: result.error, blocks: result.data?.blocks ?? [] }
}

export async function createChannelBlock(
  type: 'LOGO' | 'ADDON',
  configJson: Record<string, unknown>,
  width: 'FULL' | 'HALF' | 'THIRD' = 'FULL',
): Promise<{ error: string | null; block?: ChannelBlockView }> {
  return request<ChannelBlockView>(BLOCKS_PATH, {
    method: 'POST',
    body: JSON.stringify({ type, width, configJson }),
  })
}

export async function patchChannelBlock(
  id: string,
  patch: {
    width?: 'FULL' | 'HALF' | 'THIRD'
    position?: number
    configJson?: Record<string, unknown>
  },
): Promise<{ error: string | null; block?: ChannelBlockView }> {
  return request<ChannelBlockView>(`${BLOCKS_PATH}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteChannelBlock(id: string): Promise<{ error: string | null }> {
  return request(`${BLOCKS_PATH}/${id}`, { method: 'DELETE' })
}
