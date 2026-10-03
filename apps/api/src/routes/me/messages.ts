// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ConversationDetailQuerySchema,
  ConversationDetailSchema,
  ConversationListSchema,
  IdParamSchema,
  MessageSchema,
  MessageContactListSchema,
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
  RECIPIENT_UNAVAILABLE_BODY,
  findOrCreateConversation,
  getConversationDetail,
  listConversations,
  searchUsers,
  sendMessage,
} from '../../lib/messaging.js'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { withSafeName } from '../../lib/safe-names.js'

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

  fastify.get(
    '/api/me/messages/contacts',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'People the current user follows or who follow them, for the DM contact list',
        response: openApiResponse(MessageContactListSchema, 'MessageContactList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const relationships = await fastify.prisma.artistFollow.findMany({
        where: {
          OR: [
            { followerUserId: user.id, artist: availableUserWhere },
            { artistUserId: user.id, follower: availableUserWhere },
          ],
        },
        take: 400,
        orderBy: { createdAt: 'desc' },
        select: {
          followerUserId: true,
          artistUserId: true,
          follower: { select: { username: true, displayName: true, avatarUrl: true } },
          artist: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      })

      const contacts = new Map<
        string,
        {
          username: string
          displayName: string
          avatarUrl: string | null
          followsYou: boolean
          followedByYou: boolean
        }
      >()

      for (const relationship of relationships) {
        const followedByYou = relationship.followerUserId === user.id
        const person = withSafeName(followedByYou ? relationship.artist : relationship.follower)
        const existing = contacts.get(person.username)
        contacts.set(person.username, {
          ...person,
          followsYou: existing?.followsYou || !followedByYou,
          followedByYou: existing?.followedByYou || followedByYou,
        })
      }

      return reply.send(
        [...contacts.values()].sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        ),
      )
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
        select: { id: true, deletedAt: true, suspendedAt: true },
      })
      if (!other) return reply.status(404).send({ error: 'User not found' })
      if (other.deletedAt || other.suspendedAt) {
        return reply.status(403).send(RECIPIENT_UNAVAILABLE_BODY)
      }

      const conversationId = await findOrCreateConversation(fastify.prisma, user.id, other.id)
      return reply.send({ conversationId })
    },
  )

  // GET /api/me/messages/conversations/:id?before=&limit= — one page of the
  // thread; the newest page also marks it read
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
      const query = ConversationDetailQuerySchema.safeParse(request.query ?? {})
      if (!query.success) {
        return reply.status(400).send({ error: query.error.issues[0]?.message ?? 'Invalid query' })
      }
      const user = request.sessionUser!

      const result = await getConversationDetail(
        fastify.prisma,
        user.id,
        routeParams.id,
        query.data,
      )
      if (result.status === 'not_found') {
        return reply.status(404).send({ error: 'Conversation not found' })
      }
      if (result.status === 'invalid_before') {
        return reply
          .status(400)
          .send({ error: 'before must be a message id from this conversation or an ISO date-time' })
      }
      return reply.send(result.detail)
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

      const result = await sendMessage(fastify.prisma, user, routeParams.id, parsed.data.body)
      if (result.status === 'not_found') {
        return reply.status(404).send({ error: 'Conversation not found' })
      }
      if (result.status === 'recipient_unavailable') {
        return reply.status(403).send(RECIPIENT_UNAVAILABLE_BODY)
      }
      return reply.status(201).send(result.message)
    },
  )
}

export default meMessagesRoutes
