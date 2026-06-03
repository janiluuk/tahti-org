// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

// M22 — editable archive item metadata: title, description, tracklist, bannerUrl, commentary
// M24 — bannerUrl field
// M25 — commentary field
const meArchiveRoutes: FastifyPluginAsync = async (fastify) => {
  // PATCH /api/me/archive/:id — update item metadata
  fastify.patch('/api/me/archive/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }
    const body = request.body as {
      title?: string
      description?: string
      tracklist?: unknown
      bannerUrl?: string
      commentary?: string
      isPublic?: boolean
      isFallback?: boolean
    }

    const item = await fastify.prisma.archiveItem.findFirst({
      where: { id, channel: { userId: user.id } },
      select: { id: true },
    })
    if (!item) return reply.status(404).send({ error: 'Archive item not found' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}
    if (body.title !== undefined) {
      const t = body.title.trim()
      if (!t) return reply.status(400).send({ error: 'title cannot be empty' })
      data.title = t.slice(0, 200)
    }
    if (body.description !== undefined) data.description = body.description.slice(0, 2000) || null
    if (body.tracklist !== undefined) {
      if (body.tracklist !== null && !Array.isArray(body.tracklist)) {
        return reply.status(400).send({ error: 'tracklist must be an array or null' })
      }
      data.tracklist = body.tracklist
    }
    if (body.bannerUrl !== undefined) data.bannerUrl = body.bannerUrl.trim() || null
    if (body.commentary !== undefined) data.commentary = body.commentary.slice(0, 5000) || null
    if (body.isPublic !== undefined) data.isPublic = body.isPublic
    if (body.isFallback !== undefined) data.isFallback = body.isFallback

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: 'No fields to update' })
    }

    const updated = await fastify.prisma.archiveItem.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        description: true,
        tracklist: true,
        bannerUrl: true,
        commentary: true,
        isPublic: true,
        isFallback: true,
        status: true,
        durationSec: true,
        createdAt: true,
      },
    })

    return reply.send(updated)
  })

  // PATCH /api/me/channel/slideshow — update channel slideshow images
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
