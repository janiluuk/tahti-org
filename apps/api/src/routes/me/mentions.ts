// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

// M15 — artist mention preferences and mute management
const mentionRoutes: FastifyPluginAsync = async (fastify) => {
  // PATCH /api/me/mentions/settings — toggle mentions on/off
  fastify.patch(
    '/api/me/mentions/settings',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { mentionsEnabled } = request.body as { mentionsEnabled?: boolean }
      if (typeof mentionsEnabled !== 'boolean') {
        return reply.status(400).send({ error: 'mentionsEnabled (boolean) is required' })
      }
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { mentionsEnabled },
      })
      return reply.send({ mentionsEnabled })
    },
  )

  // POST /api/me/mentions/mute/:handle — mute mentions from an artist
  fastify.post(
    '/api/me/mentions/mute/:handle',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { handle } = request.params as { handle: string }

      const target = await fastify.prisma.user.findUnique({
        where: { username: handle },
        select: { id: true },
      })
      if (!target) return reply.status(404).send({ error: 'Artist not found' })
      if (target.id === user.id) return reply.status(400).send({ error: 'Cannot mute yourself' })

      await fastify.prisma.mentionMute.upsert({
        where: { muterId_targetUserId: { muterId: user.id, targetUserId: target.id } },
        create: { muterId: user.id, targetUserId: target.id },
        update: {},
      })
      return reply.status(201).send({ muted: handle })
    },
  )

  // DELETE /api/me/mentions/mute/:handle — unmute
  fastify.delete(
    '/api/me/mentions/mute/:handle',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { handle } = request.params as { handle: string }

      const target = await fastify.prisma.user.findUnique({
        where: { username: handle },
        select: { id: true },
      })
      if (!target) return reply.status(404).send({ error: 'Artist not found' })

      await fastify.prisma.mentionMute.deleteMany({
        where: { muterId: user.id, targetUserId: target.id },
      })
      return reply.send({ unmuted: handle })
    },
  )
}

export default mentionRoutes
