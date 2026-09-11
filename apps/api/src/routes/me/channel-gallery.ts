// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { patchChannelGallery } from './sound-helpers.js'

const meChannelGalleryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/channel/gallery', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { galleryMode: true, slideshowImages: true, videoBackgroundUrl: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    return reply.send(channel)
  })

  fastify.patch('/api/me/channel/gallery', { preHandler: requireAuth }, async (request, reply) => {
    const result = await patchChannelGallery(fastify, request.sessionUser!.id, request.body)
    if (!result.ok) return reply.status(result.status).send({ error: result.error })
    return reply.send({
      galleryMode: result.galleryMode,
      slideshowImages: result.slideshowImages,
      videoBackgroundUrl: result.videoBackgroundUrl,
    })
  })

  fastify.patch(
    '/api/me/channel/slideshow',
    { preHandler: requireAuth },
    async (request, reply) => {
      const result = await patchChannelGallery(fastify, request.sessionUser!.id, request.body)
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ slideshowImages: result.slideshowImages })
    },
  )
}

export default meChannelGalleryRoutes
