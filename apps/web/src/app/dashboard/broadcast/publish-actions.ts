// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { createTahtiClient } from '@tahti/api-client'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function apiClient() {
  const sessionCookie = cookies().get('tahti_session')
  return createTahtiClient({
    baseUrl: apiUrl,
    cookie: sessionCookie ? `tahti_session=${sessionCookie.value}` : '',
  })
}

export async function fetchAutoPublishBroadcast(): Promise<boolean> {
  const { data } = await apiClient().GET('/api/me/channel/publish-defaults')
  return data?.autoPublishBroadcast ?? true
}

export async function updateAutoPublishBroadcast(
  autoPublishBroadcast: boolean,
): Promise<{ error: string | null }> {
  const { error } = await apiClient().PATCH('/api/me/channel/publish-defaults', {
    body: { autoPublishBroadcast },
  })
  if (error) {
    return { error: (error as { error?: string }).error ?? 'Failed to save publish setting' }
  }
  return { error: null }
}
