// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  HandleParamSchema,
  MentionMutedResponseSchema,
  MentionUnmutedResponseSchema,
  MentionsEnabledResponseSchema,
  MentionsEnabledSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

// M15 — artist mention preferences and mute management
const mentionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/mentions/settings — current preferences + muted list
  fastify.get('/api/me/mentions/settings', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const row = await fastify.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        mentionsEnabled: true,
        publicMentionsEnabled: true,
        mentionsMuted: {
          select: { target: { select: { username: true, displayName: true } } },
        },
      },
    })
    return reply.send({
      mentionsEnabled: row?.mentionsEnabled ?? true,
      publicMentionsEnabled: row?.publicMentionsEnabled ?? false,
      muted: (row?.mentionsMuted ?? []).map((m) => ({
        username: m.target.username,
        displayName: m.target.displayName,
      })),
    })
  })

  // GET /api/me/mentions — recent incoming mentions
  fastify.get('/api/me/mentions', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const query = request.query as { limit?: string }
    const limit = Math.min(parseInt(query.limit ?? '20', 10), 50)

    const mentions = await fastify.prisma.mention.findMany({
      where: { targetUserId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        surface: true,
        createdAt: true,
        mentioner: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    })
    return reply.send({ mentions })
  })

  // PATCH /api/me/mentions/settings — toggle mentions on/off
  fastify.patch(
    '/api/me/mentions/settings',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(MentionsEnabledResponseSchema, 'MentionsEnabledResponse'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = MentionsEnabledSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const data: { mentionsEnabled?: boolean; publicMentionsEnabled?: boolean } = {}
      if (parsed.data.mentionsEnabled !== undefined) {
        data.mentionsEnabled = parsed.data.mentionsEnabled
      }
      if (parsed.data.publicMentionsEnabled !== undefined) {
        data.publicMentionsEnabled = parsed.data.publicMentionsEnabled
      }
      const updated = await fastify.prisma.user.update({
        where: { id: user.id },
        data,
        select: { mentionsEnabled: true, publicMentionsEnabled: true },
      })
      return reply.send(updated)
    },
  )

  // POST /api/me/mentions/mute/:handle — mute mentions from an artist
  fastify.post(
    '/api/me/mentions/mute/:handle',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponses([
          { status: 201, schema: MentionMutedResponseSchema, name: 'MentionMutedResponse' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(HandleParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { handle } = routeParams

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
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(MentionUnmutedResponseSchema, 'MentionUnmutedResponse'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(HandleParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { handle } = routeParams

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
