// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  TAHTI_SELECTS_SLUG,
  TahtiSelectsGalleryResponseSchema,
  archivePlaybackKey,
  openApiResponse,
} from '@tahti/shared'
import { getCachedJson } from '../../lib/json-cache.js'
import { presignedGetUrl } from '../../lib/minio.js'

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
    async (_request, reply) => {
      const result = await getCachedJson('tahti-selects:gallery', 60, async () => {
        const channel = await fastify.prisma.channel.findUnique({
          where: { slug: TAHTI_SELECTS_SLUG },
          select: { id: true },
        })
        if (!channel) return { items: [] }

        const rows = await fastify.prisma.curatedRotationItem.findMany({
          where: { channelId: channel.id },
          orderBy: { position: 'asc' },
          select: {
            archiveItem: {
              select: {
                id: true,
                title: true,
                bannerUrl: true,
                durationSec: true,
                mp3Key: true,
                flacKey: true,
                channel: {
                  select: { slug: true, user: { select: { username: true, displayName: true } } },
                },
              },
            },
          },
        })

        const items = await Promise.all(
          rows.map(async ({ archiveItem: item }) => {
            const playbackKey = archivePlaybackKey(item)
            const audioUrl = playbackKey ? await presignedGetUrl(playbackKey, 3600) : null
            return {
              archiveItemId: item.id,
              title: item.title,
              artistName: item.channel.user.displayName,
              artistUsername: item.channel.user.username,
              channelSlug: item.channel.slug,
              bannerUrl: item.bannerUrl,
              durationSec: item.durationSec,
              audioUrl,
            }
          }),
        )

        return { items }
      })

      return reply.send(result)
    },
  )
}

export default tahtiSelectsGalleryRoute
