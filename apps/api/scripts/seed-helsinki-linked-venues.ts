// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Imports Helsinki club/concert places used by seed-helsinki-linked-events
 * into the public venue directory (verified). Photos come from the Helsinki
 * Service Map `picture_url` when present, otherwise a recent Linked Events
 * image for that place. Also sets ArtistEvent.venueId when the event place
 * name matches.
 *
 * Attribution: City of Helsinki Linked Events / Service Map (CC BY 4.0).
 *
 * Run (prod): ssh vimage, then:
 *   docker compose -f infra/docker-compose.stack.yml exec api \
 *     tsx apps/api/scripts/seed-helsinki-linked-venues.ts
 */

import { prisma } from '@tahti/db'

const HOST_USERNAME = 'yaniho'
const PLACE_API = 'https://api.hel.fi/linkedevents/v1/place/'
const EVENT_API = 'https://api.hel.fi/linkedevents/v1/event/'
const SERVICE_MAP = 'https://www.hel.fi/palvelukarttaws/rest/v4/unit/'

const ATTRIBUTION = 'Venue data from City of Helsinki Linked Events / Service Map (CC BY 4.0).'

type VenueSeed = {
  tprekId: string
  slug: string
  /** Extra place-name fragments used to match ArtistEvent.place. */
  matchNames: string[]
}

const VENUES: VenueSeed[] = [
  {
    tprekId: '45307',
    slug: 'aaniwalli',
    matchNames: ['ääniwalli', 'aaniwalli'],
  },
  {
    tprekId: '20566',
    slug: 'tavastia-klubi',
    matchNames: ['tavastia'],
  },
  {
    tprekId: '21132',
    slug: 'kuudes-linja',
    matchNames: ['kuudes linja'],
  },
  {
    tprekId: '50582',
    slug: 'g-livelab',
    matchNames: ['g livelab', 'glivelab'],
  },
  {
    tprekId: '20633',
    slug: 'musiikkitalo',
    matchNames: ['musiikkitalo', 'helsinki music centre'],
  },
  {
    tprekId: '20663',
    slug: 'on-the-rocks',
    matchNames: ['on the rocks'],
  },
  {
    tprekId: '20815',
    slug: 'korjaamo',
    matchNames: ['korjaamo'],
  },
  {
    tprekId: '7258',
    slug: 'savoy-teatteri',
    matchNames: ['savoy'],
  },
  {
    tprekId: '9355',
    slug: 'kaapelitehdas',
    matchNames: ['kaapelitehdas', 'cable factory'],
  },
  {
    tprekId: '21030',
    slug: 'semifinal',
    matchNames: ['semifinal'],
  },
  {
    tprekId: '20472',
    slug: 'apollo-live-club',
    matchNames: ['apollo'],
  },
]

function localized(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    const map = value as Record<string, string>
    return map.fi || map.en || map.sv || Object.values(map)[0] || null
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

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

async function serviceMapPicture(tprekId: string): Promise<string | null> {
  try {
    const unit = (await fetchJson(`${SERVICE_MAP}${tprekId}/`)) as {
      picture_url?: string | null
    }
    return unit.picture_url || null
  } catch {
    return null
  }
}

async function linkedEventPicture(tprekId: string): Promise<string | null> {
  const url =
    `${EVENT_API}?` +
    new URLSearchParams({
      location: `tprek:${tprekId}`,
      page_size: '15',
      start: '2024-01-01',
    }).toString()
  const body = (await fetchJson(url)) as {
    data?: Array<{ images?: Array<{ url?: string; license?: string }> }>
  }
  let fallback: string | null = null
  for (const event of body.data ?? []) {
    for (const image of event.images ?? []) {
      if (!image.url) continue
      const license = (image.license || '').toLowerCase()
      if (license === 'event_only') {
        fallback = fallback ?? image.url
        continue
      }
      return image.url
    }
  }
  return fallback
}

async function loadPlace(tprekId: string) {
  const place = (await fetchJson(`${PLACE_API}${encodeURIComponent(`tprek:${tprekId}`)}/`)) as {
    name?: unknown
    street_address?: unknown
    address_locality?: unknown
    position?: { coordinates?: [number, number] }
    info_url?: unknown
    description?: unknown
    telephone?: unknown
  }
  const name = localized(place.name)
  const address = localized(place.street_address)
  const city = localized(place.address_locality) || 'Helsinki'
  const coords = place.position?.coordinates
  // GeoJSON: [lon, lat]
  const longitude = coords?.[0] ?? null
  const latitude = coords?.[1] ?? null
  const infoUrl = localized(place.info_url)
  const description = cleanText(localized(place.description))
  return {
    name: name || `Helsinki venue ${tprekId}`,
    address: address || city,
    city,
    latitude,
    longitude,
    infoUrl,
    description,
  }
}

async function main() {
  const host = await prisma.user.findUnique({
    where: { username: HOST_USERNAME },
    select: { id: true },
  })
  if (!host) throw new Error(`Host user @${HOST_USERNAME} not found`)

  const results: Array<{
    slug: string
    name: string
    created: boolean
    updated: boolean
    photo: boolean
    eventsLinked: number
  }> = []

  for (const spec of VENUES) {
    const place = await loadPlace(spec.tprekId)
    const servicePic = await serviceMapPicture(spec.tprekId)
    const eventPic = servicePic ? null : await linkedEventPicture(spec.tprekId)
    const photoUrl = servicePic || eventPic
    const photos = photoUrl ? [photoUrl.slice(0, 2048)] : []

    const description = [place.description, ATTRIBUTION].filter(Boolean).join(' ').slice(0, 2000)

    const externalLinks = place.infoUrl
      ? ({ website: place.infoUrl.slice(0, 500) } as Record<string, string>)
      : null

    const existing = await prisma.venue.findUnique({
      where: { slug: spec.slug },
      select: { id: true, photos: true, verifiedAt: true },
    })

    let venueId: string
    let created = false
    let updated = false

    if (!existing) {
      const createdVenue = await prisma.venue.create({
        data: {
          slug: spec.slug,
          name: place.name.slice(0, 120),
          address: place.address.slice(0, 200),
          city: place.city.slice(0, 80),
          countryCode: 'FI',
          latitude: place.latitude,
          longitude: place.longitude,
          description,
          photos,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          externalLinks: externalLinks as any,
          createdBy: host.id,
          verifiedAt: new Date(),
        },
        select: { id: true },
      })
      venueId = createdVenue.id
      created = true
    } else {
      venueId = existing.id
      await prisma.venue.update({
        where: { id: existing.id },
        data: {
          name: place.name.slice(0, 120),
          address: place.address.slice(0, 200),
          city: place.city.slice(0, 80),
          latitude: place.latitude,
          longitude: place.longitude,
          description,
          ...(existing.photos.length === 0 && photos.length > 0 ? { photos } : {}),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          externalLinks: externalLinks as any,
          verifiedAt: existing.verifiedAt ?? new Date(),
        },
      })
      updated = true
    }

    // Link ArtistEvents whose place matches this venue.
    const events = await prisma.artistEvent.findMany({
      where: { venueId: null },
      select: { id: true, place: true },
    })
    let eventsLinked = 0
    for (const event of events) {
      const placeKey = event.place.toLowerCase()
      if (!spec.matchNames.some((fragment) => placeKey.includes(fragment))) continue
      await prisma.artistEvent.update({
        where: { id: event.id },
        data: { venueId },
      })
      eventsLinked += 1
    }

    results.push({
      slug: spec.slug,
      name: place.name,
      created,
      updated,
      photo: photos.length > 0,
      eventsLinked,
    })
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        host: HOST_USERNAME,
        created: results.filter((r) => r.created).length,
        updated: results.filter((r) => r.updated).length,
        withPhoto: results.filter((r) => r.photo).length,
        eventsLinked: results.reduce((n, r) => n + r.eventsLinked, 0),
        venues: results,
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
