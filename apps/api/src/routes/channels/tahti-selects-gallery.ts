// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  TAHTI_SELECTS_SLUG,
  TahtiSelectsGalleryResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { getCachedJson } from '../../lib/json-cache.js'
import { toGatedGalleryItem, type GallerySoundRow } from '../../lib/playback-url.js'

const tahtiSelectsGalleryRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/tahti-selects/gallery',
    {
      schema: {
        tags: ['channel'],
        description: 'Discover → Tahti Selects gallery: the current curated-rotation tracks',
        response: openApiResponse(TahtiSelectsGalleryResponseSchema, 'TahtiSelectsGallery'),
      },
    },
    async (request, reply) => {
      const cached = await getCachedJson('tahti-selects:gallery', 60, async () => {
        const channel = await fastify.prisma.channel.findUnique({
          where: { slug: TAHTI_SELECTS_SLUG },
          select: { id: true },
        })
        if (!channel) return { items: [] as GallerySoundRow[] }

        const rows = await fastify.prisma.curatedRotationItem.findMany({
          where: { channelId: channel.id },
          orderBy: { position: 'asc' },
          select: {
            sound: {
              select: {
                id: true,
                title: true,
                artistName: true,
                bannerUrl: true,
                durationSec: true,
                mp3Key: true,
                flacKey: true,
                accessMode: true,
                purchaseTierId: true,
                channel: {
                  select: {
                    slug: true,
                    userId: true,
                    user: { select: { username: true, displayName: true } },
                  },
                },
              },
            },
          },
        })

        return { items: rows.map(({ sound }) => sound) }
      })

      const viewerUserId = request.sessionUser?.id ?? null
      const items = await Promise.all(
        cached.items.map((item) => toGatedGalleryItem(fastify.prisma, item, viewerUserId)),
      )

      return reply.send({ items })
    },
  )
}

export default tahtiSelectsGalleryRoute
