// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { recordMentions } from '../../lib/mentions.js'

// PATCH /api/me/profile — update bio, display name, social links, tip jar, meta-stream opt-out
const meProfileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.patch('/api/me/profile', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as {
      displayName?: string
      bio?: string
      avatarUrl?: string
      tipJarUrl?: string
      socialLinks?: unknown
      publicAttribution?: boolean
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}

    if (body.displayName !== undefined) {
      const name = body.displayName.trim()
      if (!name) return reply.status(400).send({ error: 'displayName cannot be empty' })
      data.displayName = name.slice(0, 100)
    }
    if (body.bio !== undefined) data.bio = body.bio.slice(0, 5000) || null
    if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl.trim() || null
    if (body.tipJarUrl !== undefined) data.tipJarUrl = body.tipJarUrl.trim() || null
    if (body.socialLinks !== undefined) data.socialLinks = body.socialLinks
    if (body.publicAttribution !== undefined) data.publicAttribution = body.publicAttribution

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: 'No fields to update' })
    }

    const updated = await fastify.prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        tipJarUrl: true,
        socialLinks: true,
        publicAttribution: true,
      },
    })

    if (body.bio) {
      recordMentions(fastify.prisma, user.id, body.bio, 'BIO', user.id).catch((e) =>
        fastify.log.warn(e, 'mention record failed'),
      )
    }

    return reply.send(updated)
  })

  // PATCH /api/me/channel/meta-stream — toggle Tahti Radio opt-out
  fastify.patch(
    '/api/me/channel/meta-stream',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { optOut } = request.body as { optOut?: boolean }
      if (typeof optOut !== 'boolean') {
        return reply.status(400).send({ error: 'optOut (boolean) is required' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { metaStreamOptOut: optOut },
      })

      return reply.send({ metaStreamOptOut: optOut })
    },
  )
}

export default meProfileRoutes
