// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function updateChannelCommentsEnabled(
  commentsEnabled: boolean,
): Promise<{ error: string | null; commentsEnabled?: boolean }> {
  const response = await fetch(`${apiUrl}/api/me/comments/channel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ commentsEnabled }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save' }
  }
  const data = (await response.json()) as { commentsEnabled: boolean }
  return { error: null, commentsEnabled: data.commentsEnabled }
}

export interface CommentDefaults {
  defaultTrackCommentsEnabled: boolean
  defaultChannelCommentsEnabled: boolean
}

export async function updateCommentDefaults(
  patch: Partial<CommentDefaults>,
): Promise<{ error: string | null; defaults?: CommentDefaults }> {
  const response = await fetch(`${apiUrl}/api/me/comments/defaults`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(patch),
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save' }
  }
  const defaults = (await response.json()) as CommentDefaults
  return { error: null, defaults }
}
