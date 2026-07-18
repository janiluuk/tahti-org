// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  PublicRadioSlotListSchema,
  RadioFeatureHistorySchema,
  RadioNowPlayingSchema,
  RadioRotationSchema,
  RadioSlotBookingListQuerySchema,
  TAHTI_SELECTS_SLUG,
  openApiResponse,
} from '@tahti/shared'
import { getRadioFeatureHistory } from '../../lib/radio-feature.js'

const RADIO_URL = process.env.RADIO_SERVICE_URL ?? 'http://tahti-radio:3004'

// M16 — public Tahti Radio now-playing endpoint
const radioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/radio',
    {
      schema: {
        tags: ['radio'],
        description: 'M16: Tahti Radio now-playing (proxied from tahti-radio service)',
        response: openApiResponse(RadioNowPlayingSchema, 'RadioNowPlaying'),
      },
    },
    async (_request, reply) => {
      try {
        const res = await fetch(`${RADIO_URL}/now-playing`, { signal: AbortSignal.timeout(2000) })
        const data = (await res.json()) as unknown
        return reply.send(data)
      } catch {
        // Radio service unreachable — return offline state rather than 500
        return reply.send({ live: false, channel: null })
      }
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

  // STREAM-011: public "up next" preview — the Tahti Selects curated rotation order.
  // The rotation plays in shuffle by default, so this is illustrative ("in the
  // rotation"), not a live-synced guarantee of exact play order.
  fastify.get(
    '/api/v1/radio/rotation',
    {
      schema: {
        tags: ['radio'],
        description: 'Tahti Selects curated rotation, in admin-set order',
        response: openApiResponse(RadioRotationSchema, 'RadioRotation'),
      },
    },
    async (_request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: TAHTI_SELECTS_SLUG },
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
              channel: { select: { user: { select: { displayName: true } } } },
            },
          },
        },
      })

      return reply.send(
        items.map((item) => ({
          id: item.id,
          title: item.archiveItem.title,
          artistName: item.archiveItem.channel.user.displayName,
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
              slug: true,
              user: { select: { displayName: true, username: true, avatarUrl: true } },
            },
          },
        },
      })

      return reply.send(
        rows.map((r) => ({
          id: r.id,
          startAt: r.startAt.toISOString(),
          endAt: r.endAt.toISOString(),
          note: r.note,
          artist: {
            displayName: r.channel.user.displayName,
            username: r.channel.user.username,
            avatarUrl: r.channel.user.avatarUrl,
            channelSlug: r.channel.slug,
          },
        })),
      )
    },
  )
}

export default radioRoutes
