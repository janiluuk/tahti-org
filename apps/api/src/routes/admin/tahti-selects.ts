// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

async function getTahtiSelectsChannelId(
  prisma: Parameters<FastifyPluginAsync>[0]['prisma'],
): Promise<string | null> {
  const channel = await prisma.channel.findUnique({
    where: { slug: TAHTI_SELECTS_SLUG },
    select: { id: true },
  })
  return channel?.id ?? null
}

const adminTahtiSelectsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/tahti-selects — current curated rotation, ordered
  fastify.get(
    '/api/admin/tahti-selects',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (_request, reply) => {
      const channelId = await getTahtiSelectsChannelId(fastify.prisma)
      if (!channelId) return reply.send({ items: [] })

      const items = await fastify.prisma.curatedRotationItem.findMany({
        where: { channelId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          createdAt: true,
          addedBy: { select: { displayName: true } },
          archiveItem: {
            select: {
              id: true,
              title: true,
              durationSec: true,
              license: true,
              channel: { select: { slug: true, user: { select: { displayName: true } } } },
            },
          },
        },
      })

      return reply.send({
        items: items.map((item) => ({
          id: item.id,
          position: item.position,
          addedAt: item.createdAt,
          addedBy: item.addedBy.displayName,
          archiveItemId: item.archiveItem.id,
          title: item.archiveItem.title,
          durationSec: item.archiveItem.durationSec,
          license: item.archiveItem.license,
          artistName: item.archiveItem.channel.user.displayName,
          channelSlug: item.archiveItem.channel.slug,
        })),
      })
    },
  )

  // GET /api/admin/tahti-selects/browse?q= — search public archive items to add
  fastify.get(
    '/api/admin/tahti-selects/browse',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { q } = request.query as { q?: string }
      const items = await fastify.prisma.archiveItem.findMany({
        where: {
          isPublic: true,
          status: 'READY',
          ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          title: true,
          durationSec: true,
          license: true,
          channel: { select: { slug: true, user: { select: { displayName: true } } } },
        },
      })

      return reply.send({
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          durationSec: item.durationSec,
          license: item.license,
          artistName: item.channel.user.displayName,
          channelSlug: item.channel.slug,
        })),
      })
    },
  )

  // POST /api/admin/tahti-selects/items — add { archiveItemId } to the rotation
  fastify.post(
    '/api/admin/tahti-selects/items',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { archiveItemId } = request.body as { archiveItemId?: string }
      if (!archiveItemId) return reply.status(400).send({ error: 'archiveItemId required' })

      const channelId = await getTahtiSelectsChannelId(fastify.prisma)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })

      const archiveItem = await fastify.prisma.archiveItem.findUnique({
        where: { id: archiveItemId },
        select: { isPublic: true },
      })
      if (!archiveItem) return reply.status(404).send({ error: 'Archive item not found' })
      if (!archiveItem.isPublic) {
        return reply.status(400).send({ error: 'Only public archive items can be curated' })
      }

      const existing = await fastify.prisma.curatedRotationItem.findUnique({
        where: { channelId_archiveItemId: { channelId, archiveItemId } },
      })
      if (existing) return reply.status(409).send({ error: 'Already in rotation' })

      const last = await fastify.prisma.curatedRotationItem.findFirst({
        where: { channelId },
        orderBy: { position: 'desc' },
        select: { position: true },
      })

      const item = await fastify.prisma.curatedRotationItem.create({
        data: {
          channelId,
          archiveItemId,
          position: (last?.position ?? -1) + 1,
          addedById: request.sessionUser!.id,
        },
      })

      return reply.status(201).send({ ok: true as const, id: item.id })
    },
  )

  // DELETE /api/admin/tahti-selects/items/:id — remove from rotation
  fastify.delete(
    '/api/admin/tahti-selects/items/:id',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const item = await fastify.prisma.curatedRotationItem.findUnique({ where: { id } })
      if (!item) return reply.status(404).send({ error: 'Not found' })

      await fastify.prisma.curatedRotationItem.delete({ where: { id } })
      return reply.send({ ok: true as const })
    },
  )

  // PATCH /api/admin/tahti-selects/items/:id/reorder — { position }
  fastify.patch(
    '/api/admin/tahti-selects/items/:id/reorder',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { position } = request.body as { position?: number }
      if (typeof position !== 'number' || position < 0) {
        return reply.status(400).send({ error: 'position required' })
      }

      const item = await fastify.prisma.curatedRotationItem.findUnique({ where: { id } })
      if (!item) return reply.status(404).send({ error: 'Not found' })

      const siblings = await fastify.prisma.curatedRotationItem.findMany({
        where: { channelId: item.channelId },
        orderBy: { position: 'asc' },
        select: { id: true },
      })
      const reordered = siblings.filter((s) => s.id !== id).map((s) => s.id)
      reordered.splice(Math.min(position, reordered.length), 0, id)

      await fastify.prisma.$transaction(
        reordered.map((itemId, index) =>
          fastify.prisma.curatedRotationItem.update({
            where: { id: itemId },
            data: { position: index },
          }),
        ),
      )

      return reply.send({ ok: true as const })
    },
  )
}

export default adminTahtiSelectsRoutes
