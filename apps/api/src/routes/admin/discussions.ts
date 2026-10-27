// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateDiscussionTopicSchema,
  DiscussionTopicViewSchema,
  IdParamSchema,
  UpdateDiscussionTopicSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import {
  notifyDiscussionClosed,
  notifyMembersOfDiscussionOpened,
} from '../../lib/discussion-notifications.js'
import { DISCUSSION_TOPIC_SELECT, toDiscussionTopicView } from '../../lib/discussion-view.js'

const adminDiscussionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/admin/discussions — the board opens a topic for members. The
  // board member who opens it follows it from the start.
  fastify.post(
    '/api/admin/discussions',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(DiscussionTopicViewSchema, 'DiscussionTopic'),
      },
    },
    async (request, reply) => {
      const parsed = CreateDiscussionTopicSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const actor = request.sessionUser!
      const topic = await fastify.prisma.discussionTopic.create({
        data: {
          title: parsed.data.title,
          body: parsed.data.body,
          pinned: parsed.data.pinned ?? false,
          createdById: actor.id,
          participants: { create: { userId: actor.id } },
        },
        select: DISCUSSION_TOPIC_SELECT,
      })
      await notifyMembersOfDiscussionOpened(fastify.prisma, topic, actor.id).catch(
        (err: unknown) => {
          request.log.error({ err, topicId: topic.id }, 'discussion opened notification failed')
        },
      )
      return reply.status(201).send(toDiscussionTopicView(topic))
    },
  )

  // PATCH /api/admin/discussions/:id — edit, pin, or close / reopen.
  fastify.patch(
    '/api/admin/discussions/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(DiscussionTopicViewSchema, 'DiscussionTopic'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = UpdateDiscussionTopicSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const existing = await fastify.prisma.discussionTopic.findUnique({
        where: { id: routeParams.id },
        select: { id: true, status: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Topic not found' })
      const topic = await fastify.prisma.discussionTopic.update({
        where: { id: routeParams.id },
        data: parsed.data,
        select: DISCUSSION_TOPIC_SELECT,
      })
      if (existing.status === 'OPEN' && topic.status === 'CLOSED') {
        await notifyDiscussionClosed(fastify.prisma, topic, request.sessionUser!.id).catch(
          (err: unknown) => {
            request.log.error({ err, topicId: topic.id }, 'discussion closed notification failed')
          },
        )
      }
      return reply.send(toDiscussionTopicView(topic))
    },
  )
}

export default adminDiscussionRoutes
