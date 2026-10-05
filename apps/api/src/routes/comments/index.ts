// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { availableUserWhere, notifyArtistOfNewComment, type PrismaClient } from '@tahti/db'
import {
  CommentBodySchema,
  CommentsListSchema,
  IdParamSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { shareKeyFromQuery, soundShareGrantsAccess } from '../../lib/sound-share-access.js'
import { userName } from '../../lib/safe-names.js'
import { isBlockedEitherWay } from '../../lib/user-blocks.js'

// A block between the artist and the commenter closes comments for that
// person. The wording does not say a block is the reason.
const BLOCKED_COMMENT_BODY = { error: 'You cannot comment here' }

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const COMMENTS_LIMIT = 200

/** The newest comments, oldest first, without those of deleted or suspended accounts. */
async function listComments(
  prisma: PrismaClient,
  where: { soundId: string } | { channelId: string },
  ownerUserId: string,
) {
  const newest = await prisma.comment.findMany({
    // Also without what an account the owner has blocked wrote earlier.
    where: {
      ...where,
      author: { ...availableUserWhere, blocksReceived: { none: { blockerUserId: ownerUserId } } },
    },
    orderBy: { createdAt: 'desc' },
    take: COMMENTS_LIMIT,
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  })
  return newest.reverse().map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    authorUsername: c.author.username,
    authorDisplayName: userName(c.author),
    authorAvatarUrl: c.author.avatarUrl,
  }))
}

function commenterOf(user: { id: string; username: string; displayName: string }) {
  return {
    id: user.id,
    username: user.username,
    displayName: userName(user),
  }
}

const commentsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/comments/track/:id
  fastify.get(
    '/api/comments/track/:id',
    { schema: { response: openApiResponse(CommentsListSchema, 'CommentsList') } },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const item = await fastify.prisma.sound.findUnique({
        where: { id: routeParams.id },
        select: { commentsEnabled: true, isPublic: true, channel: { select: { userId: true } } },
      })
      const visible =
        item?.isPublic ||
        (item &&
          (await soundShareGrantsAccess(
            fastify.prisma,
            routeParams.id,
            shareKeyFromQuery(request.query),
            request.sessionUser?.username ?? null,
          )))
      if (!item || !visible) return reply.status(404).send({ error: 'Track not found' })

      const comments = await listComments(
        fastify.prisma,
        { soundId: routeParams.id },
        item.channel.userId,
      )
      return reply.send({ comments, commentsEnabled: item.commentsEnabled })
    },
  )

  // POST /api/comments/track/:id { body }
  fastify.post('/api/comments/track/:id', { preHandler: requireAuth }, async (request, reply) => {
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const parsed = CommentBodySchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)

    const item = await fastify.prisma.sound.findUnique({
      where: { id: routeParams.id },
      select: {
        commentsEnabled: true,
        isPublic: true,
        title: true,
        channel: { select: { slug: true, userId: true } },
      },
    })
    const visible =
      item?.isPublic ||
      (item &&
        (await soundShareGrantsAccess(
          fastify.prisma,
          routeParams.id,
          shareKeyFromQuery(request.query),
          request.sessionUser!.username,
        )))
    if (!item || !visible) return reply.status(404).send({ error: 'Track not found' })
    if (!item.commentsEnabled) {
      return reply.status(403).send({ error: 'Comments are off for this track' })
    }
    if (await isBlockedEitherWay(fastify.prisma, item.channel.userId, request.sessionUser!.id)) {
      return reply.status(403).send(BLOCKED_COMMENT_BODY)
    }

    const comment = await fastify.prisma.comment.create({
      data: {
        body: parsed.data.body,
        authorId: request.sessionUser!.id,
        soundId: routeParams.id,
      },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    })

    await notifyArtistOfNewComment(
      fastify.prisma,
      item.channel.userId,
      commenterOf(request.sessionUser!),
      comment,
      { channelSlug: item.channel.slug, item: { id: routeParams.id, title: item.title } },
    ).catch((err: unknown) => fastify.log.warn({ err }, 'comment notification failed'))

    return reply.status(201).send({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      authorUsername: comment.author.username,
      authorDisplayName: userName(comment.author),
      authorAvatarUrl: comment.author.avatarUrl,
    })
  })

  // GET /api/comments/channel/:slug
  fastify.get(
    '/api/comments/channel/:slug',
    { schema: { response: openApiResponse(CommentsListSchema, 'CommentsList') } },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, commentsEnabled: true, userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const comments = await listComments(fastify.prisma, { channelId: channel.id }, channel.userId)
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
        select: { id: true, commentsEnabled: true, userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (!channel.commentsEnabled) {
        return reply.status(403).send({ error: 'Comments are off for this channel' })
      }
      if (await isBlockedEitherWay(fastify.prisma, channel.userId, request.sessionUser!.id)) {
        return reply.status(403).send(BLOCKED_COMMENT_BODY)
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

      await notifyArtistOfNewComment(
        fastify.prisma,
        channel.userId,
        commenterOf(request.sessionUser!),
        comment,
        { channelSlug: routeParams.slug },
      ).catch((err: unknown) => fastify.log.warn({ err }, 'comment notification failed'))

      return reply.status(201).send({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        authorUsername: comment.author.username,
        authorDisplayName: userName(comment.author),
        authorAvatarUrl: comment.author.avatarUrl,
      })
    },
  )

  // DELETE /api/comments/:id — the comment's own author, the channel/track owner, or the board
  fastify.delete('/api/comments/:id', { preHandler: requireAuth }, async (request, reply) => {
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const comment = await fastify.prisma.comment.findUnique({
      where: { id: routeParams.id },
      select: {
        authorId: true,
        sound: { select: { channel: { select: { userId: true } } } },
        channel: { select: { userId: true } },
      },
    })
    if (!comment) return reply.status(404).send({ error: 'Comment not found' })

    const ownerId = comment.sound?.channel.userId ?? comment.channel?.userId
    const user = request.sessionUser!
    if (comment.authorId !== user.id && ownerId !== user.id && !user.isBoard) {
      return reply.status(403).send({ error: 'Not allowed to delete this comment' })
    }

    await fastify.prisma.comment.delete({ where: { id: routeParams.id } })
    return reply.status(204).send()
  })
}

export default commentsRoutes
