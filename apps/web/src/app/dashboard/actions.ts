// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function prepareUpload(params: {
  title: string
  filename: string
  contentType: string
  fileSizeBytes: number
}): Promise<{ uploadId: string; uploadUrl: string; expiresAt: string }> {
  const response = await fetch(`${apiUrl}/api/uploads/prepare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionHeader(),
    },
    body: JSON.stringify(params),
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to prepare upload')
  }

  return response.json()
}

export async function completeUpload(params: {
  uploadId: string
  etag: string
  title: string
}): Promise<{ itemId: string; status: string }> {
  const response = await fetch(`${apiUrl}/api/uploads/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionHeader(),
    },
    body: JSON.stringify(params),
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to complete upload')
  }

  return response.json()
}
