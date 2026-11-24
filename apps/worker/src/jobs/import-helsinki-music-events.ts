// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { fetchText, plainExcerpt } from '../lib/music-feeds.js'

export const HELSINKI_EVENTS_SOURCE = 'linkedevents-helsinki'
/** YSO concept "musiikki" (music) in the Linked Events vocabulary. */
const MUSIC_KEYWORD = 'yso:p1808'
const API_URL = 'https://api.hel.fi/linkedevents/v1/event/'
export const EVENTS_WINDOW_DAYS = 60
export const EVENTS_PER_RUN = 100
const MAX_PAGES = 5
const HOST_USERNAME = 'tahti'
const ATTRIBUTION = 'Lähde: Helsingin kaupungin tapahtumarajapinta (Linked Events), CC BY 4.0.'

type Localized = { fi?: string | null; en?: string | null; sv?: string | null } | null

export interface LinkedEvent {
  id: string
  name: Localized
  short_description?: Localized
  start_time: string | null
  end_time?: string | null
  event_status?: string | null
  super_event_type?: string | null
  info_url?: Localized
  images?: Array<{ url?: string | null }>
  location?: {
    name?: Localized
    address_locality?: Localized
  } | null
}

function pick(value: Localized | undefined): string {
  return (value?.fi || value?.en || value?.sv || '').trim()
}

export interface ImportedEventFields {
  title: string
  description: string
  place: string
  location: string
  eventUrl: string
  imageUrl: string | null
  startAt: Date
  endAt: Date | null
}

/** Event fields for one Linked Events entry, or null when it should not be
 * imported (umbrella series, cancelled, no title, place or start time). */
export function toImportedEvent(event: LinkedEvent): ImportedEventFields | null {
  if (event.super_event_type) return null
  if (event.event_status && event.event_status !== 'EventScheduled') return null
  const title = pick(event.name)
  const place = pick(event.location?.name)
  if (!title || !place || !event.start_time) return null
  const startAt = new Date(event.start_time)
  if (Number.isNaN(startAt.getTime())) return null
  const endAt = event.end_time ? new Date(event.end_time) : null
  const summary = plainExcerpt(pick(event.short_description), 400)
  return {
    title: title.slice(0, 200),
    description: [summary, ATTRIBUTION].filter(Boolean).join('\n\n'),
    place: place.slice(0, 200),
    location: pick(event.location?.address_locality) || 'Helsinki',
    eventUrl:
      pick(event.info_url) || `https://tapahtumat.hel.fi/fi/events/${encodeURIComponent(event.id)}`,
    imageUrl: event.images?.find((image) => image.url)?.url ?? null,
    startAt,
    endAt: endAt && !Number.isNaN(endAt.getTime()) ? endAt : null,
  }
}

export interface ImportHelsinkiEventsResult {
  imported: number
  skipped: number
  hostMissing: boolean
}

/**
 * Imports upcoming Helsinki music events from the city's open Linked Events
 * API as DRAFT events hosted by the Tahti account, for the board to publish
 * the ones worth showing. (externalSource, externalId) prevents duplicates.
 */
export async function processImportHelsinkiMusicEventsJob(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<ImportHelsinkiEventsResult> {
  const host = await prisma.user.findUnique({
    where: { username: HOST_USERNAME },
    select: { id: true },
  })
  if (!host) {
    console.warn(
      JSON.stringify({
        component: 'import-helsinki-music-events',
        msg: `host account "${HOST_USERNAME}" missing, nothing imported`,
      }),
    )
    return { imported: 0, skipped: 0, hostMissing: true }
  }

  const end = new Date(now.getTime() + EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    keyword: MUSIC_KEYWORD,
    start: now.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    sort: 'start_time',
    page_size: String(EVENTS_PER_RUN),
    include: 'location',
    // Recurring and umbrella "series" parents are not concerts themselves.
    super_event_type: 'none',
  })
  // `start` matches anything still running, so long-running items that began
  // earlier fill the first pages; page on until enough upcoming events remain.
  const events: LinkedEvent[] = []
  let url: string | null = `${API_URL}?${params}`
  for (let page = 0; url && page < MAX_PAGES && events.length < EVENTS_PER_RUN; page++) {
    const body = await fetchText(url, 'application/json')
    const json = JSON.parse(body) as { data?: LinkedEvent[]; meta?: { next?: string | null } }
    for (const event of json.data ?? []) {
      if (event.start_time && new Date(event.start_time) >= now) events.push(event)
    }
    const next = json.meta?.next ?? null
    url = next && next.startsWith(API_URL) ? next : null
  }

  const known = await prisma.artistEvent.findMany({
    where: {
      externalSource: HELSINKI_EVENTS_SOURCE,
      externalId: { in: events.map((event) => event.id) },
    },
    select: { externalId: true },
  })
  const seen = new Set(known.map((row) => row.externalId))

  let imported = 0
  let skipped = 0
  for (const event of events) {
    const fields = toImportedEvent(event)
    if (!fields || seen.has(event.id) || fields.startAt < now) {
      skipped++
      continue
    }
    await prisma.artistEvent.create({
      data: {
        ...fields,
        userId: host.id,
        timezone: 'Europe/Helsinki',
        status: 'DRAFT',
        externalSource: HELSINKI_EVENTS_SOURCE,
        externalId: event.id,
      },
    })
    imported++
  }

  console.log(
    JSON.stringify({
      component: 'import-helsinki-music-events',
      msg: `imported ${imported} draft event(s)`,
      imported,
      skipped,
    }),
  )
  return { imported, skipped, hostMissing: false }
}
