// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export async function fetchGrantPreview(forYear: number): Promise<{
  error: string | null
  preview?: {
    poolCents: number
    totalUnits: number
    grantCount: number
    alreadyRun: boolean
    artists: Array<{
      username: string
      displayName: string
      units: number
      amountCents: number
      anomalies: Array<{ code: string; message: string }>
    }>
  }
}> {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) return { error: 'Not signed in' }

  const res = await fetch(`${apiUrl}/api/admin/grants/preview/${forYear}`, {
    headers: { Cookie: `tahti_session=${sessionCookie.value}` },
    cache: 'no-store',
  })

  if (res.status === 403) return { error: 'Board access required' }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { error?: string }).error ?? 'Preview failed' }
  }

  return { error: null, preview: await res.json() }
}
