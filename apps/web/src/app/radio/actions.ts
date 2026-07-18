// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export interface PublicRadioSlot {
  id: string
  startAt: string
  endAt: string
  note: string | null
  artist: {
    displayName: string
    username: string
    avatarUrl: string | null
    channelSlug: string | null
  }
}

export async function listPublicRadioSlots(
  from: string,
  to: string,
): Promise<{ slots: PublicRadioSlot[]; error: string | null }> {
  try {
    const res = await fetch(
      `${apiUrl}/api/v1/radio/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { next: { revalidate: 30 } },
    )
    if (!res.ok) return { slots: [], error: 'Failed to load the live-artist calendar' }
    return { slots: (await res.json()) as PublicRadioSlot[], error: null }
  } catch {
    return { slots: [], error: 'Failed to load the live-artist calendar' }
  }
}
