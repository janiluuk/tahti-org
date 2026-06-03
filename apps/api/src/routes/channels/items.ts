// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { presignedGetUrl } from '../../lib/minio.js'
import { serializeArchiveItem } from '../../lib/archive-metadata.js'

const channelItemsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/channels/:slug/items', async (request, reply) => {
    const { slug } = request.params as { slug: string }

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
      },
    })

    const itemsWithUrls = await Promise.all(
      items.map(async (item) => {
        const audioUrl = item.mp3Key ? await presignedGetUrl(item.mp3Key, 3600) : null
        return {
          ...serializeArchiveItem(item),
          fileSizeBytes: Number(item.fileSizeBytes),
          audioUrl,
        }
      }),
    )

    return reply.send(itemsWithUrls)
  })
}

export default channelItemsRoute
