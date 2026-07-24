// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ConversationDetailSchema,
  ConversationListSchema,
  IdParamSchema,
  MessageSchema,
  SendMessageSchema,
  StartConversationResponseSchema,
  StartConversationSchema,
  UserSearchResponseSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  findOrCreateConversation,
  getConversationDetail,
  listConversations,
  searchUsers,
  sendMessage,
} from '../../lib/messaging.js'

const meMessagesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/users/search?q= — for @-mention / "message this user" autocomplete
  fastify.get(
    '/api/users/search',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'User search for @-mention and message-composer autocomplete',
        response: openApiResponse(UserSearchResponseSchema, 'UserSearchResults'),
      },
    },
    async (request, reply) => {
      const q = (request.query as { q?: string }).q ?? ''
      const user = request.sessionUser!
      return reply.send(await searchUsers(fastify.prisma, q, user.id))
    },
  )

  // GET /api/me/messages/conversations — inbox list
  fastify.get(
    '/api/me/messages/conversations',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: "M38: list the current user's DM conversations",
        response: openApiResponse(ConversationListSchema, 'ConversationList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      return reply.send(await listConversations(fastify.prisma, user.id))
    },
  )

  // POST /api/me/messages/conversations — find-or-create a 1:1 conversation
  fastify.post(
    '/api/me/messages/conversations',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(StartConversationResponseSchema, 'StartConversation'),
      },
    },
    async (request, reply) => {
      const parsed = StartConversationSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!
      if (parsed.data.username === user.username) {
        return reply.status(400).send({ error: 'You cannot message yourself' })
      }
      const other = await fastify.prisma.user.findUnique({
        where: { username: parsed.data.username },
        select: { id: true },
      })
      if (!other) return reply.status(404).send({ error: 'User not found' })

      const conversationId = await findOrCreateConversation(fastify.prisma, user.id, other.id)
      return reply.send({ conversationId })
    },
  )

  // GET /api/me/messages/conversations/:id — thread + marks it read
  fastify.get(
    '/api/me/messages/conversations/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ConversationDetailSchema, 'ConversationDetail'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const user = request.sessionUser!

      const detail = await getConversationDetail(fastify.prisma, user.id, routeParams.id)
      if (!detail) return reply.status(404).send({ error: 'Conversation not found' })
      return reply.send(detail)
    },
  )

  // POST /api/me/messages/conversations/:id/messages — send a message
  fastify.post(
    '/api/me/messages/conversations/:id/messages',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponses([{ status: 201, schema: MessageSchema, name: 'Message' }]),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = SendMessageSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const message = await sendMessage(fastify.prisma, user, routeParams.id, parsed.data.body)
      if (!message) return reply.status(404).send({ error: 'Conversation not found' })
      return reply.status(201).send(message)
    },
  )
}

export default meMessagesRoutes
