// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Replaces hand-written demo ArtistEvent rows with real upcoming Helsinki
 * region gigs from the City of Helsinki Linked Events API (CC BY 4.0).
 * Events are hosted on the yaniho account as curated listings (Prisma
 * insert — no follower notifications).
 *
 * Removes the titles seeded by seed-demo-events-and-parties.ts (mock album
 * nights etc.) before inserting. Idempotent on (userId, title, startAt) for
 * Linked Events rows.
 *
 * Run (prod): ssh vimage, then:
 *   docker compose -f infra/docker-compose.stack.yml exec api \
 *     tsx apps/api/scripts/seed-helsinki-linked-events.ts
 */

import { prisma } from '@tahti/db'

const HOST_USERNAME = 'yaniho'
const LINKED_EVENTS = 'https://api.hel.fi/linkedevents/v1/event/'
const ATTRIBUTION = 'Source: City of Helsinki Linked Events (CC BY 4.0).'
const MAX_EVENTS = 12
const DAYS_AHEAD = 90

/** Helsinki club / concert venue place ids (tprek) in Linked Events. */
const VENUE_IDS = [
  'tprek:45307', // Ääniwalli
  'tprek:20566', // Tavastia
  'tprek:21132', // Kuudes Linja
  'tprek:50582', // G Livelab
  'tprek:20633', // Musiikkitalo
  'tprek:20663', // On the Rocks
  'tprek:20815', // Korjaamo
  'tprek:7258', // Savoy
  'tprek:9355', // Kaapelitehdas
  'tprek:21030', // Semifinal
  'tprek:20472', // Apollo Live Club
]

/** Titles from seed-demo-events-and-parties.ts — remove these mocks. */
const MOCK_TITLES = [
  'Euphorizer LP — album night',
  'Late studio open — progressive & techno',
  'Forest Cover — outdoor listening',
  'Pale Circuit — EP release show',
  'Loose Thread — Riga listening night',
  'Faint Echo — Tallinn premiere',
  'Hollow Bell — warehouse session',
  'Shortwave — Sunday matinee',
]

const SKIP_TITLE =
  /soiva urku|pre-concert|little overture|playground|musiikkihetki|workshop|kurssi|esittely|christmas carols/i

type LinkedEvent = {
  title: string
  description: string
  place: string
  location: string
  startAt: Date
  endAt: Date | null
  eventUrl: string | null
  imageUrl: string | null
}

function localized(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    const map = value as Record<string, string>
    return map.en || map.fi || map.sv || Object.values(map)[0] || null
  }
  return null
}

function cleanText(raw: string | null): string | null {
  if (!raw) return null
  const text = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || null
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

async function fetchLinkedEvents(): Promise<LinkedEvent[]> {
  const end = new Date()
  end.setUTCDate(end.getUTCDate() + DAYS_AHEAD)
  const endDay = end.toISOString().slice(0, 10)

  const collected: LinkedEvent[] = []
  let url: string | null =
    `${LINKED_EVENTS}?` +
    new URLSearchParams({
      start: 'today',
      end: endDay,
      page_size: '100',
      include: 'location,keywords',
      location: VENUE_IDS.join(','),
      event_type: 'General',
    }).toString()

  while (url && collected.length < 80) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Linked Events HTTP ${response.status} for ${url}`)
    }
    const body = (await response.json()) as {
      data?: Array<Record<string, unknown>>
      meta?: { next?: string | null }
    }
    for (const row of body.data ?? []) {
      if (row.event_status && row.event_status !== 'EventScheduled') continue
      const startAt = toDate(typeof row.start_time === 'string' ? row.start_time : null)
      if (!startAt) continue
      if (startAt.getUTCHours() < 14) continue
      const title = localized(row.name)
      if (!title || SKIP_TITLE.test(title)) continue

      const loc =
        row.location && typeof row.location === 'object'
          ? (row.location as Record<string, unknown>)
          : {}
      const place = localized(loc.name) || 'Helsinki'
      const city = localized(loc.address_locality) || 'Helsinki'
      const images = Array.isArray(row.images) ? row.images : []
      let imageUrl: string | null = null
      for (const image of images) {
        if (!image || typeof image !== 'object') continue
        const im = image as Record<string, unknown>
        const license = String(im.license ?? '').toLowerCase()
        if (license === 'event_only') continue
        if (typeof im.url === 'string' && im.url) {
          imageUrl = im.url
          break
        }
      }
      if (!imageUrl && images[0] && typeof images[0] === 'object') {
        const first = images[0] as Record<string, unknown>
        if (typeof first.url === 'string') imageUrl = first.url
      }

      let eventUrl = localized(row.info_url)
      if (!eventUrl && Array.isArray(row.external_links)) {
        for (const link of row.external_links) {
          if (
            link &&
            typeof link === 'object' &&
            typeof (link as { link?: string }).link === 'string'
          ) {
            eventUrl = (link as { link: string }).link
            break
          }
        }
      }

      const short =
        cleanText(localized(row.short_description)) || cleanText(localized(row.description))
      const description = short
        ? `${short.slice(0, 1900)} ${ATTRIBUTION}`.slice(0, 2000)
        : ATTRIBUTION

      collected.push({
        title: title.slice(0, 160),
        description,
        place: place.slice(0, 160),
        location: (city.includes('Finland') ? city : `${city}, Finland`).slice(0, 160),
        startAt,
        endAt: toDate(typeof row.end_time === 'string' ? row.end_time : null),
        eventUrl: eventUrl?.slice(0, 500) || null,
        imageUrl: imageUrl?.slice(0, 500) || null,
      })
    }
    url = body.meta?.next ?? null
  }

  collected.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  const deduped: LinkedEvent[] = []
  const keys = new Set<string>()
  for (const event of collected) {
    const key = `${event.title.toLowerCase()}|${event.startAt.toISOString().slice(0, 10)}`
    if (keys.has(key)) continue
    keys.add(key)
    deduped.push(event)
  }

  const picked: LinkedEvent[] = []
  const perPlace = new Map<string, number>()
  for (const event of deduped) {
    if (picked.length >= MAX_EVENTS) break
    const count = perPlace.get(event.place) ?? 0
    if (count >= 3 && picked.length < MAX_EVENTS - 2) continue
    perPlace.set(event.place, count + 1)
    picked.push(event)
  }
  return picked
}

async function main() {
  const host = await prisma.user.findUnique({
    where: { username: HOST_USERNAME },
    select: { id: true },
  })
  if (!host) throw new Error(`Host user @${HOST_USERNAME} not found`)

  const deletedMocks = await prisma.artistEvent.deleteMany({
    where: { title: { in: MOCK_TITLES } },
  })

  const linked = await fetchLinkedEvents()
  const results: Array<{ title: string; startAt: string; created: boolean }> = []
  for (const event of linked) {
    const existing = await prisma.artistEvent.findFirst({
      where: {
        userId: host.id,
        title: event.title,
        startAt: event.startAt,
      },
      select: { id: true },
    })
    if (existing) {
      results.push({
        title: event.title,
        startAt: event.startAt.toISOString(),
        created: false,
      })
      continue
    }
    await prisma.artistEvent.create({
      data: {
        userId: host.id,
        title: event.title,
        description: event.description,
        place: event.place,
        location: event.location,
        eventUrl: event.eventUrl,
        ticketUrl: null,
        imageUrl: event.imageUrl,
        gallery: [],
        startAt: event.startAt,
        endAt: event.endAt,
        timezone: 'Europe/Helsinki',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    })
    results.push({
      title: event.title,
      startAt: event.startAt.toISOString(),
      created: true,
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        host: HOST_USERNAME,
        deletedMocks: deletedMocks.count,
        fetched: linked.length,
        created: results.filter((r) => r.created).length,
        skipped: results.filter((r) => !r.created).length,
        events: results,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
