// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function updateFeatureRequest(
  id: string,
  params: { status?: string; reviewNote?: string; mergedIntoId?: string | null },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/feature-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Update failed' }
  }
  revalidatePath('/admin/feature-requests')
  return { error: null }
}

export async function generateFeatureRequestQuarterlyReport(params?: {
  year?: number
  quarter?: number
}): Promise<{ error: string | null; downloadUrl?: string }> {
  const res = await fetch(`${apiUrl}/api/admin/feature-requests/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params ?? {}),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Report generation failed' }
  }
  const data = (await res.json()) as { downloadUrl: string }
  revalidatePath('/admin/feature-requests')
  return { error: null, downloadUrl: data.downloadUrl }
}
