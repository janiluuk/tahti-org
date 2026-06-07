// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// M27 — moderator roles: artists delegate chat moderation (ban/unban) to
// trusted listeners, who act on the channel's behalf via a slug-scoped API.

import type { FastifyPluginAsync } from 'fastify'
import {
  AddModeratorSchema,
  ChannelModeratorListSchema,
  ChannelModeratorViewSchema,
  ChatBanListSchema,
  ChatBanSchema,
  ChatOkResponseSchema,
  ModerateChatBanParamsSchema,
  ModeratedChannelListSchema,
  SlugParamSchema,
  UserIdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveChannelForModeration } from '../../lib/channel-access.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const meModerators: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/channel/moderators — list delegated moderators (owner only)
  fastify.get(
    '/api/me/channel/moderators',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(ChannelModeratorListSchema, 'ChannelModeratorList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const moderators = await fastify.prisma.channelModerator.findMany({
        where: { channelId: channel.id },
        orderBy: { grantedAt: 'asc' },
        include: { user: { select: { id: true, username: true, displayName: true } } },
      })

      return reply.send(
        moderators.map((m) => ({
          userId: m.user.id,
          username: m.user.username,
          displayName: m.user.displayName,
          grantedAt: m.grantedAt,
        })),
      )
    },
  )

  // POST /api/me/channel/moderators { username } — delegate to a trusted listener (owner only)
  fastify.post(
    '/api/me/channel/moderators',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponses([
          { status: 201, schema: ChannelModeratorViewSchema, name: 'ChannelModeratorView' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = AddModeratorSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const { username } = parsed.data

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const target = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true, displayName: true },
      })
      if (!target) return reply.status(404).send({ error: 'User not found' })
      if (target.id === user.id) {
        return reply.status(400).send({ error: 'Cannot add yourself as a moderator' })
      }

      const moderator = await fastify.prisma.channelModerator.upsert({
        where: { channelId_userId: { channelId: channel.id, userId: target.id } },
        create: { channelId: channel.id, userId: target.id },
        update: {},
      })

      return reply.status(201).send({
        userId: target.id,
        username: target.username,
        displayName: target.displayName,
        grantedAt: moderator.grantedAt,
      })
    },
  )

  // DELETE /api/me/channel/moderators/:userId — revoke (owner only)
  fastify.delete(
    '/api/me/channel/moderators/:userId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(UserIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { userId } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.channelModerator.deleteMany({
        where: { channelId: channel.id, userId },
      })

      return reply.status(204).send()
    },
  )

  // GET /api/me/moderate — channels the current user owns or moderates
  fastify.get(
    '/api/me/moderate',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(ModeratedChannelListSchema, 'ModeratedChannelList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const owned = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { slug: true, user: { select: { displayName: true } } },
      })

      const modRows = await fastify.prisma.channelModerator.findMany({
        where: { userId: user.id },
        orderBy: { grantedAt: 'asc' },
        include: { channel: { select: { slug: true, user: { select: { displayName: true } } } } },
      })

      const result: Array<{ slug: string; displayName: string; isOwner: boolean }> = []
      if (owned)
        result.push({ slug: owned.slug, displayName: owned.user.displayName, isOwner: true })
      for (const m of modRows) {
        result.push({
          slug: m.channel.slug,
          displayName: m.channel.user.displayName,
          isOwner: false,
        })
      }

      return reply.send(result)
    },
  )

  // GET /api/me/moderate/:slug/chat/bans — list current bans (owner or moderator)
  fastify.get(
    '/api/me/moderate/:slug/chat/bans',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(ChatBanListSchema, 'ChatBanList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await resolveChannelForModeration(fastify.prisma, routeParams.slug, user.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const bans = await fastify.prisma.chatBan.findMany({
        where: { channelId: channel.id },
        orderBy: { bannedAt: 'desc' },
        select: { fingerprintHash: true, bannedAt: true },
      })

      return reply.send(bans)
    },
  )

  // POST /api/me/moderate/:slug/chat/ban { fingerprintHash } — ban (owner or moderator)
  fastify.post(
    '/api/me/moderate/:slug/chat/ban',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponses([
          { status: 201, schema: ChatOkResponseSchema, name: 'ChatOkResponse' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const parsed = ChatBanSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const { fingerprintHash } = parsed.data

      const channel = await resolveChannelForModeration(fastify.prisma, routeParams.slug, user.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.chatBan.upsert({
        where: { channelId_fingerprintHash: { channelId: channel.id, fingerprintHash } },
        create: { channelId: channel.id, fingerprintHash },
        update: { bannedAt: new Date() },
      })

      return reply.status(201).send({ ok: true })
    },
  )

  // DELETE /api/me/moderate/:slug/chat/ban/:fingerprintHash — unban (owner or moderator)
  fastify.delete(
    '/api/me/moderate/:slug/chat/ban/:fingerprintHash',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ModerateChatBanParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug, fingerprintHash } = routeParams

      const channel = await resolveChannelForModeration(fastify.prisma, slug, user.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.chatBan.deleteMany({
        where: { channelId: channel.id, fingerprintHash },
      })

      return reply.status(204).send()
    },
  )
}

export default meModerators
