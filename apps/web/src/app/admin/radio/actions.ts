// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

function adminFetch(path: string, method: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    method,
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
  })
}

export async function optOutChannel(channelId: string) {
  await adminFetch(`/api/admin/radio/opt-out/${channelId}`, 'POST')
  revalidatePath('/admin/radio')
}

export async function removeOptOut(channelId: string) {
  await adminFetch(`/api/admin/radio/opt-out/${channelId}`, 'DELETE')
  revalidatePath('/admin/radio')
}

export async function resetRotation(channelId: string) {
  await adminFetch(`/api/admin/radio/reset-rotation/${channelId}`, 'POST')
  revalidatePath('/admin/radio')
}
