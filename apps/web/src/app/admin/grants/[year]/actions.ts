// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function authHeader(): Record<string, string> {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) return {}
  return { Cookie: `tahti_session=${sessionCookie.value}` }
}

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
  const res = await fetch(`${apiUrl}/api/admin/grants/preview/${forYear}`, {
    headers: authHeader(),
    cache: 'no-store',
  })

  if (res.status === 403) return { error: 'Board access required' }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { error?: string }).error ?? 'Preview failed' }
  }
  return { error: null, preview: await res.json() }
}

export async function runGrantCycle(forYear: number): Promise<{
  error?: string
  poolCents?: number
  grantCount?: number
  reserveCents?: number
  alreadyRun?: boolean
}> {
  const res = await fetch(`${apiUrl}/api/admin/grants/run/${forYear}`, {
    method: 'POST',
    headers: authHeader(),
  })

  if (res.status === 403) return { error: 'Board access required' }
  if (res.status === 409) return { alreadyRun: true }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: (body as { error?: string }).error ?? 'Run failed' }
  }

  const data = (await res.json()) as {
    poolCents: number
    grantCount: number
    reserveCents: number
  }
  return { poolCents: data.poolCents, grantCount: data.grantCount, reserveCents: data.reserveCents }
}
