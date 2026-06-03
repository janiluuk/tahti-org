// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelProgrammePatchSchema,
  ChannelProgrammeViewSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meProgrammeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/programme',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: fallback programme (offline playback order)',
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, fallbackMode: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const items = await fastify.prisma.archiveItem.findMany({
        where: { channelId: channel.id, status: 'READY' },
        orderBy: [{ fallbackOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          status: true,
          durationSec: true,
          isFallback: true,
          fallbackOrder: true,
          lastFallbackPlayedAt: true,
          createdAt: true,
        },
      })

      return reply.send({
        fallbackMode: channel.fallbackMode,
        items,
      })
    },
  )

  fastify.patch(
    '/api/me/channel/programme',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ChannelProgrammePatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      if (parsed.data.fallbackMode === undefined && parsed.data.items === undefined) {
        return reply.status(400).send({ error: 'fallbackMode or items required' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      if (parsed.data.fallbackMode !== undefined) {
        await fastify.prisma.channel.update({
          where: { id: channel.id },
          data: { fallbackMode: parsed.data.fallbackMode },
        })
      }

      if (parsed.data.items !== undefined) {
        const ids = parsed.data.items.map((i) => i.archiveItemId)
        const owned = await fastify.prisma.archiveItem.findMany({
          where: { channelId: channel.id, id: { in: ids } },
          select: { id: true },
        })
        const ownedIds = new Set(owned.map((o) => o.id))
        for (const row of parsed.data.items) {
          if (!ownedIds.has(row.archiveItemId)) {
            return reply.status(400).send({ error: `Unknown archive item ${row.archiveItemId}` })
          }
        }

        await fastify.prisma.$transaction(
          parsed.data.items.map((row) =>
            fastify.prisma.archiveItem.update({
              where: { id: row.archiveItemId },
              data: {
                isFallback: row.isFallback,
                ...(row.fallbackOrder !== undefined ? { fallbackOrder: row.fallbackOrder } : {}),
              },
            }),
          ),
        )
      }

      const updated = await fastify.prisma.channel.findUnique({
        where: { id: channel.id },
        select: { fallbackMode: true },
      })
      const items = await fastify.prisma.archiveItem.findMany({
        where: { channelId: channel.id, status: 'READY' },
        orderBy: [{ fallbackOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          status: true,
          durationSec: true,
          isFallback: true,
          fallbackOrder: true,
          lastFallbackPlayedAt: true,
          createdAt: true,
        },
      })

      return reply.send({
        fallbackMode: updated?.fallbackMode ?? 'shuffle',
        items,
      })
    },
  )
}

export default meProgrammeRoutes
