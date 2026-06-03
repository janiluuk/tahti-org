// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { config } from '../../config.js'

// Liquidsoap calls this to get the current fallback playlist for a channel.
// Returns an extended M3U with HTTP URLs to the MP3 files.
const channelFallbackRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/internal/channels/:channelId/fallback.m3u', async (request, reply) => {
    const { channelId } = request.params as { channelId: string }

    // Validate internal caller via shared secret header
    const auth = (request.headers['authorization'] as string | undefined) ?? ''
    if (auth !== `Bearer ${config.internalSecret}`) {
      return reply.status(401).send('unauthorized')
    }

    const items = await fastify.prisma.archiveItem.findMany({
      where: { channelId, status: 'READY', mp3Key: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, mp3Key: true, durationSec: true },
    })

    if (items.length === 0) {
      // Return a silent fallback so Liquidsoap doesn't crash
      return reply.header('Content-Type', 'audio/x-mpegurl').send('#EXTM3U\n# no items yet\n')
    }

    const lines: string[] = ['#EXTM3U']
    for (const item of items) {
      const duration = item.durationSec ?? -1
      lines.push(`#EXTINF:${duration},${item.title}`)
      lines.push(`${config.minio.publicEndpoint}/${config.minio.bucket}/${item.mp3Key}`)
    }

    return reply.header('Content-Type', 'audio/x-mpegurl').send(lines.join('\n') + '\n')
  })
}

export default channelFallbackRoute
