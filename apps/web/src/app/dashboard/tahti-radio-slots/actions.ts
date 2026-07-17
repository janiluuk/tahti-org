// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { RadioSlotBookingItem } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function listRadioSlotBookings(
  from: string,
  to: string,
): Promise<{ bookings: RadioSlotBookingItem[]; error: string | null }> {
  const res = await fetch(
    `${apiUrl}/api/me/radio-slot-bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { headers: { Cookie: sessionHeader() }, cache: 'no-store' },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { bookings: [], error: (data as { error?: string }).error ?? 'Failed to load calendar' }
  }
  return { bookings: data as RadioSlotBookingItem[], error: null }
}

export async function createRadioSlotBooking(params: {
  startAt: string
  endAt: string
  note?: string
}): Promise<{ booking?: RadioSlotBookingItem; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/radio-slot-bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to book slot' }
  }
  return { booking: data as RadioSlotBookingItem, error: null }
}

export async function cancelRadioSlotBooking(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/radio-slot-bookings/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to cancel booking' }
  }
  return { error: null }
}
