// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../../plugins/auth.js'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  unpublished: z.enum(['true', 'false']).optional(),
})

const meBroadcastRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/broadcasts/recent', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = QuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query parameters' })

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: request.sessionUser!.id },
      select: { id: true },
    })
    if (!channel) return reply.send({ broadcasts: [] })

    const rows = await fastify.prisma.broadcast.findMany({
      where: {
        channelId: channel.id,
        recordingKey: { not: null },
      },
      orderBy: { startedAt: 'desc' },
      take: parsed.data.unpublished === 'true' ? 500 : parsed.data.limit,
      select: {
        id: true,
        title: true,
        source: true,
        startedAt: true,
        endedAt: true,
        recordingKey: true,
        archiveItemId: true,
      },
    })

    const archiveItems = await fastify.prisma.archiveItem.findMany({
      where: { id: { in: rows.flatMap((row) => (row.archiveItemId ? [row.archiveItemId] : [])) } },
      select: { id: true, title: true, status: true, durationSec: true },
    })
    const archiveById = new Map(archiveItems.map((item) => [item.id, item]))
    const visibleRows = rows
      .filter((row) => {
        if (parsed.data.unpublished !== 'true') return true
        if (!row.archiveItemId) return true
        return archiveById.get(row.archiveItemId)?.status !== 'READY'
      })
      .slice(0, parsed.data.limit)

    return reply.send({
      broadcasts: visibleRows.map((row) => {
        const archiveItem = row.archiveItemId ? archiveById.get(row.archiveItemId) : undefined
        return {
          id: row.id,
          title: row.title,
          source: row.source,
          startedAt: row.startedAt.toISOString(),
          endedAt: row.endedAt?.toISOString() ?? null,
          recordingKey: row.recordingKey,
          archiveItemId: row.archiveItemId,
          archiveItemTitle: archiveItem?.title,
          archiveItemStatus: archiveItem?.status,
          durationSec:
            archiveItem?.durationSec ??
            (row.endedAt
              ? Math.max(0, Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 1000))
              : undefined),
        }
      }),
    })
  })
}

export default meBroadcastRoutes
