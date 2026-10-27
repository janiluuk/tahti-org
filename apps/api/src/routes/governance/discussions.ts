// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  DiscussionTopicDetailSchema,
  DiscussionTopicListSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireMember } from '../../plugins/auth.js'
import { DISCUSSION_TOPIC_SELECT, toDiscussionTopicView } from '../../lib/discussion-view.js'
import { userName } from '../../lib/safe-names.js'

const POSTS_LIMIT = 500

const discussionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/governance/discussions — every topic, pinned first, then the
  // most recently active; with whether the caller follows / muted each.
  fastify.get(
    '/api/v1/governance/discussions',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionTopicListSchema, 'DiscussionTopicList'),
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.id
      const rows = await fastify.prisma.discussionTopic.findMany({
        orderBy: [{ pinned: 'desc' }, { lastPostAt: 'desc' }],
        take: 200,
        select: {
          ...DISCUSSION_TOPIC_SELECT,
          participants: { where: { userId }, select: { mutedAt: true } },
        },
      })
      return reply.send({
        topics: rows.map((row) => ({
          ...toDiscussionTopicView(row),
          following: row.participants.length > 0,
          muted: Boolean(row.participants[0]?.mutedAt),
        })),
      })
    },
  )

  // GET /api/v1/governance/discussions/:id — the topic and its posts, oldest first.
  fastify.get(
    '/api/v1/governance/discussions/:id',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(DiscussionTopicDetailSchema, 'DiscussionTopicDetail'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const userId = request.sessionUser!.id
      const row = await fastify.prisma.discussionTopic.findUnique({
        where: { id: routeParams.id },
        select: {
          ...DISCUSSION_TOPIC_SELECT,
          participants: { where: { userId }, select: { mutedAt: true } },
          posts: {
            orderBy: { createdAt: 'asc' },
            take: POSTS_LIMIT,
            select: {
              id: true,
              body: true,
              createdAt: true,
              author: { select: { username: true, displayName: true } },
            },
          },
        },
      })
      if (!row) return reply.status(404).send({ error: 'Topic not found' })
      return reply.send({
        ...toDiscussionTopicView(row),
        following: row.participants.length > 0,
        muted: Boolean(row.participants[0]?.mutedAt),
        posts: row.posts.map((post) => ({
          id: post.id.toString(),
          body: post.body,
          author: post.author ? userName(post.author) : 'Deleted account',
          createdAt: post.createdAt.toISOString(),
        })),
      })
    },
  )
}

export default discussionRoutes
