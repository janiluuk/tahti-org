// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type { LiveShowSeriesView, ScheduledLiveShowView } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const session = cookies().get('tahti_session')
  return session ? `tahti_session=${session.value}` : ''
}

export async function updateChannelSchedule(payload: {
  nextBroadcastAt: string | null
  nextBroadcastNote: string | null
}): Promise<{ error?: string }> {
  const session = cookies().get('tahti_session')
  if (!session) return { error: 'Not signed in' }

  const res = await fetch(`${apiUrl}/api/me/channel/schedule`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `tahti_session=${session.value}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: body.error ?? `HTTP ${res.status}` }
  }
  return {}
}

export async function createLiveShowSeries(payload: {
  name: string
  description: string | null
  tagline: string | null
  artworkUrl: string | null
  showType: 'LIVE_SET' | 'TALK'
  visibility: 'PUBLIC' | 'FAN_ONLY'
  autoPublish: boolean
  episodeNumberEnabled: boolean
  nextEpisodeNumber: number
}): Promise<{ data?: LiveShowSeriesView; error?: string }> {
  const res = await fetch(`${apiUrl}/api/me/channel/show-series`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as LiveShowSeriesView & { error?: string }
  return res.ok ? { data: body } : { error: body.error ?? `HTTP ${res.status}` }
}

export async function scheduleLiveShowEpisode(
  seriesId: string,
  startAt: string,
  details: {
    title: string | null
    venue: string | null
    location: string | null
    artworkUrl: string | null
  },
): Promise<{ data?: ScheduledLiveShowView; error?: string }> {
  const res = await fetch(`${apiUrl}/api/me/channel/show-series/${seriesId}/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ startAt, ...details }),
  })
  const body = (await res.json().catch(() => ({}))) as ScheduledLiveShowView & { error?: string }
  return res.ok ? { data: body } : { error: body.error ?? `HTTP ${res.status}` }
}

export async function updateLiveShowSeriesRecurrence(
  seriesId: string,
  recurrence: {
    recurrenceEnabled: boolean
    recurrenceDays: number[]
    recurrenceTimeOfDay: string | null
    recurrenceDurationMin: number | null
    recurrenceTimezone: string | null
  },
): Promise<{ data?: LiveShowSeriesView; error?: string }> {
  const res = await fetch(`${apiUrl}/api/me/channel/show-series/${seriesId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(recurrence),
  })
  const body = (await res.json().catch(() => ({}))) as LiveShowSeriesView & { error?: string }
  return res.ok ? { data: body } : { error: body.error ?? `HTTP ${res.status}` }
}

export async function cancelScheduledLiveShow(showId: string): Promise<{ error?: string }> {
  const res = await fetch(`${apiUrl}/api/me/channel/scheduled-shows/${showId}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
  })
  if (res.ok) return {}
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return { error: body.error ?? `HTTP ${res.status}` }
}
