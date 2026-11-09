// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtistEventShareListSchema,
  ArtistEventShareParamSchema,
  ArtistEventShareSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { enqueueSocialPostDispatch } from '../../lib/social-post.js'
import { requireAuth } from '../../plugins/auth.js'

type ShareRow = {
  id: string
  platform: string
  state: 'PENDING' | 'SENT' | 'FAILED'
  error: string | null
  createdAt: Date
  sentAt: Date | null
}

const shareSelect = {
  id: true,
  platform: true,
  state: true,
  error: true,
  createdAt: true,
  sentAt: true,
} as const

function serializeShare(row: ShareRow) {
  return {
    id: row.id,
    platform: row.platform as 'MASTODON' | 'BLUESKY',
    state: row.state,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
  }
}

const eventShareRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/events/:id/shares — where the event was announced, and how it went
  fastify.get(
    '/api/me/events/:id/shares',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistEventShareListSchema, 'ArtistEventShareList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const event = await fastify.prisma.artistEvent.findFirst({
        where: { id: routeParams.id, userId: user.id },
        select: { id: true },
      })
      if (!event) return reply.status(404).send({ error: 'Event not found' })
      const rows = await fastify.prisma.socialPost.findMany({
        where: { eventId: event.id, userId: user.id },
        orderBy: { createdAt: 'asc' },
        select: shareSelect,
      })
      return reply.send(rows.map(serializeShare))
    },
  )

  // POST /api/me/events/:id/shares/:postId/retry — send a failed announcement again
  fastify.post(
    '/api/me/events/:id/shares/:postId/retry',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistEventShareSchema, 'ArtistEventShare'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ArtistEventShareParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const post = await fastify.prisma.socialPost.findFirst({
        where: { id: routeParams.postId, eventId: routeParams.id, userId: user.id },
        select: shareSelect,
      })
      if (!post) return reply.status(404).send({ error: 'Share not found' })
      if (post.state !== 'FAILED') {
        return reply.status(409).send({ error: 'Only a failed share can be retried' })
      }
      const updated = await fastify.prisma.socialPost.update({
        where: { id: post.id },
        data: { state: 'PENDING', error: null, attempts: 0 },
        select: shareSelect,
      })
      await enqueueSocialPostDispatch(post.id)
      return reply.send(serializeShare(updated))
    },
  )
}

export default eventShareRoutes
