// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

export async function provisionChannel(): Promise<{ error?: string; slug?: string }> {
  const session = cookies().get('tahti_session')
  if (!session) return { error: 'Not signed in' }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/me/channel/provision`, {
    method: 'POST',
    headers: { Cookie: `tahti_session=${session.value}` },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: body.error ?? `HTTP ${res.status}` }
  }
  const body = (await res.json()) as { slug: string }
  return { slug: body.slug }
}
