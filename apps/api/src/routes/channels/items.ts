// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelArchiveItemsResponseSchema,
  SlugParamSchema,
  archivePlaybackKey,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { presignedGetUrl } from '../../lib/minio.js'
import { serializeArchiveItem } from '../../lib/archive-metadata.js'

const channelItemsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/items',
    {
      schema: {
        tags: ['channel'],
        description: 'Public archive items for channel page',
        response: openApiResponse(ChannelArchiveItemsResponseSchema, 'ChannelArchiveItems'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      const items = await fastify.prisma.archiveItem.findMany({
        where: { channelId: channel.id, status: 'READY', isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          description: true,
          durationSec: true,
          fileSizeBytes: true,
          mp3Key: true,
          flacKey: true,
          createdAt: true,
          releasedAt: true,
          genre: true,
          genreCustom: true,
          subGenres: true,
          contentType: true,
          mixVersion: true,
          bpm: true,
          musicalKey: true,
          bpmDetected: true,
          keyDetected: true,
          useDetectedBpmKey: true,
          bannerUrl: true,
          license: true,
          commentary: true,
          tracklist: true,
          repostToDownload: true,
          followToDownload: true,
          backgroundUrl: true,
          slideshowUrls: true,
        },
      })

      const itemsWithUrls = await Promise.all(
        items.map(async (item) => {
          const playbackKey = archivePlaybackKey(item)
          const audioUrl = playbackKey ? await presignedGetUrl(playbackKey, 3600) : null
          return {
            ...serializeArchiveItem(item),
            fileSizeBytes: Number(item.fileSizeBytes),
            audioUrl,
          }
        }),
      )

      return reply.send(itemsWithUrls)
    },
  )
}

export default channelItemsRoute
