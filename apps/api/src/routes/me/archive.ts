// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import {
  archiveItemMetadataSelect,
  metadataPatchFromBody,
  serializeArchiveItem,
} from '../../lib/archive-metadata.js'

const meArchiveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/archive', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.send([])

    const items = await fastify.prisma.archiveItem.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: archiveItemMetadataSelect,
    })
    return reply.send(items.map((i) => serializeArchiveItem(i)))
  })

  fastify.get('/api/me/archive/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }

    const item = await fastify.prisma.archiveItem.findFirst({
      where: { id, channel: { userId: user.id } },
      select: archiveItemMetadataSelect,
    })
    if (!item) return reply.status(404).send({ error: 'Archive item not found' })
    return reply.send(serializeArchiveItem(item))
  })

  fastify.patch('/api/me/archive/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }

    const item = await fastify.prisma.archiveItem.findFirst({
      where: { id, channel: { userId: user.id } },
      select: { id: true },
    })
    if (!item) return reply.status(404).send({ error: 'Archive item not found' })

    const patch = metadataPatchFromBody(request.body)
    if (!patch.ok) return reply.status(400).send({ error: patch.error })

    if (patch.title !== undefined) {
      const t = patch.title.trim()
      if (!t) return reply.status(400).send({ error: 'title cannot be empty' })
      patch.data.title = t.slice(0, 200)
    }

    const updated = await fastify.prisma.archiveItem.update({
      where: { id },
      data: patch.data,
      select: archiveItemMetadataSelect,
    })

    return reply.send(serializeArchiveItem(updated))
  })

  fastify.patch(
    '/api/me/channel/slideshow',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const body = request.body as { slideshowImages?: unknown }

      if (!Array.isArray(body.slideshowImages)) {
        return reply.status(400).send({ error: 'slideshowImages must be an array' })
      }
      const images = (body.slideshowImages as unknown[])
        .filter((u) => typeof u === 'string')
        .slice(0, 10) as string[]

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { slideshowImages: images },
      })

      return reply.send({ slideshowImages: images })
    },
  )
}

export default meArchiveRoutes
