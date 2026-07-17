// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  CommentBodySchema,
  CommentsListSchema,
  IdParamSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

async function listComments(
  prisma: PrismaClient,
  where: { archiveItemId: string } | { channelId: string },
) {
  const rows = await prisma.comment.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  })
  return rows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    authorUsername: c.author.username,
    authorDisplayName: c.author.displayName,
    authorAvatarUrl: c.author.avatarUrl,
  }))
}

const commentsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/comments/track/:id
  fastify.get(
    '/api/comments/track/:id',
    { schema: { response: openApiResponse(CommentsListSchema, 'CommentsList') } },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const item = await fastify.prisma.archiveItem.findUnique({
        where: { id: routeParams.id },
        select: { commentsEnabled: true, isPublic: true },
      })
      if (!item || !item.isPublic) return reply.status(404).send({ error: 'Track not found' })

      const comments = await listComments(fastify.prisma, { archiveItemId: routeParams.id })
      return reply.send({ comments, commentsEnabled: item.commentsEnabled })
    },
  )

  // POST /api/comments/track/:id { body }
  fastify.post(
    '/api/comments/track/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = CommentBodySchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const item = await fastify.prisma.archiveItem.findUnique({
        where: { id: routeParams.id },
        select: { commentsEnabled: true, isPublic: true },
      })
      if (!item || !item.isPublic) return reply.status(404).send({ error: 'Track not found' })
      if (!item.commentsEnabled) {
        return reply.status(403).send({ error: 'Comments are off for this track' })
      }

      const comment = await fastify.prisma.comment.create({
        data: {
          body: parsed.data.body,
          authorId: request.sessionUser!.id,
          archiveItemId: routeParams.id,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      })

      return reply.status(201).send({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        authorUsername: comment.author.username,
        authorDisplayName: comment.author.displayName,
        authorAvatarUrl: comment.author.avatarUrl,
      })
    },
  )

  // GET /api/comments/channel/:slug
  fastify.get(
    '/api/comments/channel/:slug',
    { schema: { response: openApiResponse(CommentsListSchema, 'CommentsList') } },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, commentsEnabled: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const comments = await listComments(fastify.prisma, { channelId: channel.id })
      return reply.send({ comments, commentsEnabled: channel.commentsEnabled })
    },
  )

  // POST /api/comments/channel/:slug { body }
  fastify.post(
    '/api/comments/channel/:slug',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = CommentBodySchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, commentsEnabled: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (!channel.commentsEnabled) {
        return reply.status(403).send({ error: 'Comments are off for this channel' })
      }

      const comment = await fastify.prisma.comment.create({
        data: {
          body: parsed.data.body,
          authorId: request.sessionUser!.id,
          channelId: channel.id,
        },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      })

      return reply.status(201).send({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        authorUsername: comment.author.username,
        authorDisplayName: comment.author.displayName,
        authorAvatarUrl: comment.author.avatarUrl,
      })
    },
  )

  // DELETE /api/comments/:id — the comment's own author, or the channel/track owner
  fastify.delete('/api/comments/:id', { preHandler: requireAuth }, async (request, reply) => {
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const comment = await fastify.prisma.comment.findUnique({
      where: { id: routeParams.id },
      select: {
        authorId: true,
        archiveItem: { select: { channel: { select: { userId: true } } } },
        channel: { select: { userId: true } },
      },
    })
    if (!comment) return reply.status(404).send({ error: 'Comment not found' })

    const ownerId = comment.archiveItem?.channel.userId ?? comment.channel?.userId
    const user = request.sessionUser!
    if (comment.authorId !== user.id && ownerId !== user.id) {
      return reply.status(403).send({ error: 'Not allowed to delete this comment' })
    }

    await fastify.prisma.comment.delete({ where: { id: routeParams.id } })
    return reply.status(204).send()
  })
}

export default commentsRoutes
