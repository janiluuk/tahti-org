// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelIdParamSchema, parseRouteParams } from '@tahti/shared'
import { config } from '../../config.js'
import { buildFallbackPlaybackRows, renderFallbackM3u } from '../../lib/fallback-playlist.js'

// Liquidsoap calls this to get the current fallback playlist for a channel.
// Returns an extended M3U with HTTP URLs to archive playback files (MP3 or FLAC).
const channelFallbackRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/internal/channels/:channelId/fallback.m3u', async (request, reply) => {
    const routeParams = parseRouteParams(ChannelIdParamSchema, request.params)
    if (!routeParams) return reply.status(401).send('invalid path')
    const { channelId } = routeParams

    // Validate internal caller via shared secret header
    const auth = (request.headers['authorization'] as string | undefined) ?? ''
    if (auth !== `Bearer ${config.internalSecret}`) {
      return reply.status(401).send('unauthorized')
    }

    const channel = await fastify.prisma.channel.findUnique({
      where: { id: channelId },
      select: { fallbackMode: true },
    })
    if (!channel) {
      return reply.status(404).send('channel not found')
    }

    const items = await fastify.prisma.archiveItem.findMany({
      where: {
        channelId,
        status: 'READY',
        OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
      },
      select: {
        id: true,
        title: true,
        mp3Key: true,
        flacKey: true,
        durationSec: true,
        isFallback: true,
        fallbackOrder: true,
        lastFallbackPlayedAt: true,
      },
    })

    const rows = buildFallbackPlaybackRows(items, channel.fallbackMode)
    const body = renderFallbackM3u(rows, config.minio.publicEndpoint, config.minio.bucket)

    return reply.header('Content-Type', 'audio/x-mpegurl').send(body)
  })
}

export default channelFallbackRoute
