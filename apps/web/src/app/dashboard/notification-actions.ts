// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { NotificationView } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function fetchMyNotifications(): Promise<{
  notifications: NotificationView[]
  unreadCount: number
}> {
  const res = await fetch(`${apiUrl}/api/me/notifications`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return { notifications: [], unreadCount: 0 }
  return (await res.json()) as { notifications: NotificationView[]; unreadCount: number }
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch(`${apiUrl}/api/me/notifications/read-all`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
}
