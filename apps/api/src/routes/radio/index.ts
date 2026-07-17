// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  RadioFeatureHistorySchema,
  RadioNowPlayingSchema,
  RadioRotationSchema,
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
}

export default radioRoutes
