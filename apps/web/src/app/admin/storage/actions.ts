// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

export async function setUserQuota(
  userId: string,
  quotaBytes: number,
): Promise<{ ok: boolean; error?: string }> {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/admin/storage/users/${userId}/quota`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `tahti_session=${sessionCookie?.value ?? ''}`,
    },
    body: JSON.stringify({ quotaBytes }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { ok: false, error: body.error ?? 'Failed to update quota' }
  }
  return { ok: true }
}
