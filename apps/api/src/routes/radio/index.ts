// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  PublicRadioSlotListSchema,
  RadioFeatureHistorySchema,
  RadioNowPlayingSchema,
  RadioRecentlyPlayedSchema,
  RadioRotationSchema,
  RadioShowDetailSchema,
  RadioSlotBookingListQuerySchema,
  TAHTI_RADIO_SLUG,
  openApiResponse,
  resolveColorScheme,
  type ColorScheme,
} from '@tahti/shared'
import { getRadioFeatureHistory } from '../../lib/radio-feature.js'
import { resolveChannelUrl } from '../../lib/channel-url.js'

const RECENTLY_PLAYED_LIMIT = 10

function slotColorScheme(
  colorSchemeJson: string | null | undefined,
  avatarPaletteJson: string | null | undefined,
): ColorScheme | null {
  // Prefer profile-pic palette; fall back to the channel's manual brand scheme.
  const fromAvatar = resolveColorScheme(null, avatarPaletteJson ?? null)
  const fromChannel = resolveColorScheme(colorSchemeJson ?? null, null)
  if (avatarPaletteJson) return fromAvatar
  if (colorSchemeJson) return fromChannel
  return null
}

function nextAndLastShow(
  bookings: Array<{ channelId: string; startAt: Date; endAt: Date }>,
  now: Date,
): Map<string, { nextShowAt: string | null; lastShowAt: string | null }> {
  const map = new Map<string, { nextShowAt: string | null; lastShowAt: string | null }>()
  for (const b of bookings) {
    const cur = map.get(b.channelId) ?? { nextShowAt: null, lastShowAt: null }
    if (b.endAt > now) {
      if (!cur.nextShowAt || b.startAt.toISOString() < cur.nextShowAt) {
        cur.nextShowAt = b.startAt.toISOString()
      }
    } else if (!cur.lastShowAt || b.startAt.toISOString() > cur.lastShowAt) {
      cur.lastShowAt = b.startAt.toISOString()
    }
    map.set(b.channelId, cur)
  }
  return map
}

// M16 — public Tahti Radio now-playing endpoint
const radioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/radio',
    {
      schema: {
        tags: ['radio'],
        description:
          'M16: Tahti Radio now-playing — is a booked artist currently relaying live, ' +
          'derived straight from RadioSlotBooking rather than a separate service',
        response: openApiResponse(RadioNowPlayingSchema, 'RadioNowPlaying'),
      },
    },
    async (_request, reply) => {
      const now = new Date()
      const liveBooking = await fastify.prisma.radioSlotBooking.findFirst({
        where: { startAt: { lte: now }, endAt: { gt: now } },
        select: { channel: { select: { slug: true, user: { select: { displayName: true } } } } },
      })

      if (!liveBooking) return reply.send({ live: false, channel: null })

      return reply.send({
        live: true,
        channel: {
          slug: liveBooking.channel.slug,
          artistName: liveBooking.channel.user.displayName,
        },
      })
    },
  )

  fastify.get(
    '/api/v1/radio/history',
    {
      schema: {
        tags: ['radio'],
        description: 'M16: last featured channels on Tahti Radio',
        response: openApiResponse(RadioFeatureHistorySchema, 'RadioFeatureHistory'),
      },
    },
    async (_request, reply) => {
      const history = await getRadioFeatureHistory(fastify.prisma, 10)
      return reply.send(history)
    },
  )

  // "Recently played" — actual track history (services/orchestrator/src/now-playing-sync.ts
  // logs one row per real track change), not the curated rotation's set order
  // (/rotation) or which artists' live streams got relayed (/history).
  fastify.get(
    '/api/v1/radio/recently-played',
    {
      schema: {
        tags: ['radio'],
        description: 'What actually played on Tahti Radio recently, most recent first',
        response: openApiResponse(RadioRecentlyPlayedSchema, 'RadioRecentlyPlayed'),
      },
    },
    async (_request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: TAHTI_RADIO_SLUG },
        select: { id: true },
      })
      if (!channel) return reply.send([])

      const rows = await fastify.prisma.radioPlayLog.findMany({
        where: { channelId: channel.id },
        orderBy: { playedAt: 'desc' },
        take: RECENTLY_PLAYED_LIMIT,
        select: {
          id: true,
          title: true,
          artistName: true,
          artistUsername: true,
          artworkUrl: true,
          playedAt: true,
        },
      })

      return reply.send(rows.map((r) => ({ ...r, playedAt: r.playedAt.toISOString() })))
    },
  )

  // STREAM-011: public "up next" preview — Tahti Radio's own curated rotation
  // order (the same per-channel CuratedRotationItem rows Liquidsoap's
  // fallback.m3u lookup reads, mirrored from Tahti Selects by
  // seed-tahti-radio-rotation.ts but tracked separately per channelId since).
  // The rotation plays in shuffle by default, so this is illustrative ("in the
  // rotation"), not a live-synced guarantee of exact play order.
  fastify.get(
    '/api/v1/radio/rotation',
    {
      schema: {
        tags: ['radio'],
        description: 'Tahti Radio curated rotation, in admin-set order',
        response: openApiResponse(RadioRotationSchema, 'RadioRotation'),
      },
    },
    async (_request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: TAHTI_RADIO_SLUG },
        select: { id: true },
      })
      if (!channel) return reply.send([])

      const items = await fastify.prisma.curatedRotationItem.findMany({
        where: { channelId: channel.id },
        orderBy: { position: 'asc' },
        take: 20,
        select: {
          id: true,
          archiveItem: {
            select: {
              title: true,
              artistName: true,
              bannerUrl: true,
              channel: { select: { user: { select: { displayName: true, username: true } } } },
            },
          },
        },
      })

      return reply.send(
        items.map((item) => ({
          id: item.id,
          title: item.archiveItem.title,
          artistName: item.archiveItem.artistName ?? item.archiveItem.channel.user.displayName,
          artistUsername: item.archiveItem.artistName
            ? null
            : item.archiveItem.channel.user.username,
          artworkUrl: item.archiveItem.bannerUrl,
        })),
      )
    },
  )

  // Public calendar of booked live-artist slots on Tahti Radio — no auth, so
  // listeners (not just members) can see who's playing live and when.
  fastify.get(
    '/api/v1/radio/slots',
    {
      schema: {
        tags: ['radio'],
        description: 'Public calendar of booked live-artist slots on Tahti Radio',
        response: openApiResponse(PublicRadioSlotListSchema, 'PublicRadioSlotList'),
      },
    },
    async (request, reply) => {
      const parsed = RadioSlotBookingListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
      }
      const from = new Date(parsed.data.from)
      const to = new Date(parsed.data.to)
      if (to <= from) return reply.status(400).send({ error: '"to" must be after "from"' })

      const rows = await fastify.prisma.radioSlotBooking.findMany({
        where: { startAt: { lt: to }, endAt: { gt: from } },
        orderBy: { startAt: 'asc' },
        include: {
          channel: {
            select: {
              id: true,
              slug: true,
              colorSchemeJson: true,
              streamOverlayCoverUrl: true,
              user: {
                select: {
                  displayName: true,
                  username: true,
                  avatarUrl: true,
                  avatarPaletteJson: true,
                },
              },
            },
          },
        },
      })

      const channelIds = [...new Set(rows.map((r) => r.channel.id))]
      const now = new Date()
      const scheduleRows =
        channelIds.length === 0
          ? []
          : await fastify.prisma.radioSlotBooking.findMany({
              where: { channelId: { in: channelIds } },
              select: { channelId: true, startAt: true, endAt: true },
              orderBy: { startAt: 'asc' },
            })
      const scheduleByChannel = nextAndLastShow(scheduleRows, now)

      return reply.send(
        rows.map((r) => {
          const schedule = scheduleByChannel.get(r.channel.id) ?? {
            nextShowAt: null,
            lastShowAt: null,
          }
          return {
            id: r.id,
            startAt: r.startAt.toISOString(),
            endAt: r.endAt.toISOString(),
            note: r.note,
            showType: r.showType,
            coverUrl: r.channel.streamOverlayCoverUrl,
            colorScheme: slotColorScheme(
              r.channel.colorSchemeJson,
              r.channel.user.avatarPaletteJson,
            ),
            nextShowAt: schedule.nextShowAt,
            lastShowAt: schedule.lastShowAt,
            artist: {
              displayName: r.channel.user.displayName,
              username: r.channel.user.username,
              avatarUrl: r.channel.user.avatarUrl,
              channelSlug: r.channel.slug,
            },
          }
        }),
      )
    },
  )

  // Radio "show" detail page — there's no separate Show entity, so this is an
  // artist's full Tahti Radio booking history: past episodes (aired) plus
  // whatever's still scheduled. Public/no-auth, same as /slots.
  fastify.get<{ Params: { channelSlug: string } }>(
    '/api/v1/radio/show/:channelSlug',
    {
      schema: {
        tags: ['radio'],
        description: "An artist's Tahti Radio show: past + upcoming booked slots",
        response: openApiResponse(RadioShowDetailSchema, 'RadioShowDetail'),
      },
    },
    async (request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: request.params.channelSlug },
        select: {
          id: true,
          slug: true,
          colorSchemeJson: true,
          streamOverlayCoverUrl: true,
          user: {
            select: {
              displayName: true,
              username: true,
              avatarUrl: true,
              avatarPaletteJson: true,
              bio: true,
            },
          },
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Show not found' })

      const now = new Date()
      const [pastRows, upcomingRows] = await Promise.all([
        fastify.prisma.radioSlotBooking.findMany({
          where: { channelId: channel.id, endAt: { lte: now } },
          orderBy: { startAt: 'desc' },
          take: 50,
          select: {
            id: true,
            startAt: true,
            endAt: true,
            note: true,
            showType: true,
            // Broadcast.archiveItemId is a bare scalar column (no Prisma
            // relation to ArchiveItem declared on either model) — resolved
            // via a second batch query below, not a nested select.
            broadcasts: { select: { archiveItemId: true }, take: 1 },
          },
        }),
        fastify.prisma.radioSlotBooking.findMany({
          where: { channelId: channel.id, endAt: { gt: now } },
          orderBy: { startAt: 'asc' },
          select: { id: true, startAt: true, endAt: true, note: true, showType: true },
        }),
      ])

      const archiveItemIds = [
        ...new Set(
          pastRows.flatMap((r) => r.broadcasts.map((b) => b.archiveItemId).filter((id) => id)),
        ),
      ] as string[]
      // Only a *published* recording counts as "the artist published it" —
      // an archived-but-still-private item shouldn't show up as a public
      // recording link on this no-auth page.
      const recordingRows =
        archiveItemIds.length === 0
          ? []
          : await fastify.prisma.archiveItem.findMany({
              where: { id: { in: archiveItemIds }, isPublic: true, status: 'READY' },
              select: { id: true, title: true, channel: { select: { slug: true } } },
            })
      const recordingByArchiveItemId = new Map(recordingRows.map((r) => [r.id, r]))

      const toEpisode = (r: {
        id: string
        startAt: Date
        endAt: Date
        note: string | null
        showType: 'LIVE_SET' | 'TALK'
        broadcasts?: { archiveItemId: string | null }[]
      }) => {
        const archiveItemId = r.broadcasts?.[0]?.archiveItemId
        const recordingItem = archiveItemId ? recordingByArchiveItemId.get(archiveItemId) : null
        return {
          id: r.id,
          startAt: r.startAt.toISOString(),
          endAt: r.endAt.toISOString(),
          note: r.note,
          showType: r.showType,
          recording: recordingItem
            ? {
                archiveItemId: recordingItem.id,
                title: recordingItem.title,
                channelItemUrl: resolveChannelUrl(recordingItem.channel.slug, {
                  hash: `archive-item-${recordingItem.id}`,
                }),
              }
            : null,
        }
      }

      return reply.send({
        artist: {
          displayName: channel.user.displayName,
          username: channel.user.username,
          avatarUrl: channel.user.avatarUrl,
          channelSlug: channel.slug,
          bio: channel.user.bio,
          coverUrl: channel.streamOverlayCoverUrl,
          colorScheme: slotColorScheme(channel.colorSchemeJson, channel.user.avatarPaletteJson),
        },
        pastEpisodes: pastRows.map(toEpisode),
        upcomingEpisodes: upcomingRows.map(toEpisode),
        nextShowAt: upcomingRows[0]?.startAt.toISOString() ?? null,
        lastShowAt: pastRows[0]?.startAt.toISOString() ?? null,
      })
    },
  )
}

export default radioRoutes
