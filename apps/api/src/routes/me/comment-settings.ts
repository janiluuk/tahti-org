// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CommentDefaultsPatchSchema,
  CommentDefaultsResponseSchema,
  CommentsEnabledPatchSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const meCommentSettings: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/comments/defaults — the defaults applied to new tracks/channel
  fastify.get(
    '/api/me/comments/defaults',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(CommentDefaultsResponseSchema, 'CommentDefaults') },
    },
    async (request, reply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.sessionUser!.id },
        select: { defaultTrackCommentsEnabled: true, defaultChannelCommentsEnabled: true },
      })
      return reply.send(user)
    },
  )

  // PATCH /api/me/comments/defaults
  fastify.patch(
    '/api/me/comments/defaults',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(CommentDefaultsResponseSchema, 'CommentDefaults') },
    },
    async (request, reply) => {
      const parsed = CommentDefaultsPatchSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const updated = await fastify.prisma.user.update({
        where: { id: request.sessionUser!.id },
        data: parsed.data,
        select: { defaultTrackCommentsEnabled: true, defaultChannelCommentsEnabled: true },
      })
      return reply.send(updated)
    },
  )

  // GET /api/me/comments/channel — current commenting state for the artist's own channel
  fastify.get(
    '/api/me/comments/channel',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(CommentsEnabledPatchSchema, 'CommentsEnabled') },
    },
    async (request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { commentsEnabled: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      return reply.send(channel)
    },
  )

  // PATCH /api/me/comments/channel — toggle commenting on the artist's own channel
  fastify.patch(
    '/api/me/comments/channel',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(CommentsEnabledPatchSchema, 'CommentsEnabled') },
    },
    async (request, reply) => {
      const parsed = CommentsEnabledPatchSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const updated = await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { commentsEnabled: parsed.data.commentsEnabled },
        select: { commentsEnabled: true },
      })
      return reply.send(updated)
    },
  )
}

export default meCommentSettings
