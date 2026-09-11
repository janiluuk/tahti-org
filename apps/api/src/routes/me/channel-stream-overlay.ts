// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelStreamOverlayPatchSchema } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meChannelStreamOverlayRoutes: FastifyPluginAsync = async (fastify) => {
  // Multistream video overlay — title/subtitle/cover baked into the RTMP
  // mirror pushes' video track (see buildRtmpMirrorOutput). Shared across all
  // of a channel's targets; falls back to display name + avatar when unset.
  fastify.get(
    '/api/me/channel/stream-overlay',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: {
          streamOverlayTitle: true,
          streamOverlaySubtitle: true,
          streamOverlayShowTitle: true,
          streamOverlayTextColor: true,
          streamOverlayScrimEnabled: true,
          streamOverlayCoverUrl: true,
          streamOverlayBackdropUrl: true,
          streamOverlayVisualPreset: true,
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      return reply.send(channel)
    },
  )

  fastify.patch(
    '/api/me/channel/stream-overlay',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ChannelStreamOverlayPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const {
        streamOverlayTitle,
        streamOverlaySubtitle,
        streamOverlayShowTitle,
        streamOverlayTextColor,
        streamOverlayScrimEnabled,
        streamOverlayCoverUrl,
        streamOverlayBackdropUrl,
        streamOverlayVisualPreset,
      } = parsed.data

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const updated = await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: {
          ...(streamOverlayTitle !== undefined
            ? { streamOverlayTitle: streamOverlayTitle || null }
            : {}),
          ...(streamOverlaySubtitle !== undefined
            ? { streamOverlaySubtitle: streamOverlaySubtitle || null }
            : {}),
          ...(streamOverlayShowTitle !== undefined ? { streamOverlayShowTitle } : {}),
          ...(streamOverlayTextColor !== undefined
            ? { streamOverlayTextColor: streamOverlayTextColor || null }
            : {}),
          ...(streamOverlayScrimEnabled !== undefined ? { streamOverlayScrimEnabled } : {}),
          ...(streamOverlayCoverUrl !== undefined
            ? { streamOverlayCoverUrl: streamOverlayCoverUrl || null }
            : {}),
          ...(streamOverlayBackdropUrl !== undefined
            ? { streamOverlayBackdropUrl: streamOverlayBackdropUrl || null }
            : {}),
          ...(streamOverlayVisualPreset !== undefined ? { streamOverlayVisualPreset } : {}),
        },
        select: {
          streamOverlayTitle: true,
          streamOverlaySubtitle: true,
          streamOverlayShowTitle: true,
          streamOverlayTextColor: true,
          streamOverlayScrimEnabled: true,
          streamOverlayCoverUrl: true,
          streamOverlayBackdropUrl: true,
          streamOverlayVisualPreset: true,
        },
      })
      return reply.send(updated)
    },
  )
}

export default meChannelStreamOverlayRoutes
