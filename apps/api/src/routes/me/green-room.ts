// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AddGreenRoomInviteSchema,
  GreenRoomInviteViewSchema,
  GreenRoomSessionViewSchema,
  PatchGreenRoomSessionSchema,
  UserIdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  getActiveBroadcast,
  listGreenRoomCandidates,
  listGreenRoomInvites,
  syncGreenRoomInvites,
} from '../../lib/green-room.js'

const meGreenRoomRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/green-room',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(GreenRoomSessionViewSchema, 'GreenRoomSession'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          state: true,
          greenRoomDefaultInvitePool: true,
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const broadcast = await getActiveBroadcast(fastify.prisma, channel.id)
      if (!broadcast) {
        return reply.send({
          enabled: false,
          channelState: channel.state,
          invitePool: channel.greenRoomDefaultInvitePool,
          invites: [],
          candidates: await listGreenRoomCandidates(
            fastify.prisma,
            channel.id,
            user.id,
            channel.greenRoomDefaultInvitePool,
          ),
        })
      }

      const invitePool = channel.greenRoomDefaultInvitePool
      const [invites, candidates] = await Promise.all([
        listGreenRoomInvites(fastify.prisma, broadcast.id),
        listGreenRoomCandidates(fastify.prisma, channel.id, user.id, invitePool),
      ])

      return reply.send({
        enabled: broadcast.greenRoomEnabled,
        channelState: broadcast.channel.state,
        invitePool,
        invites,
        candidates,
      })
    },
  )

  fastify.patch(
    '/api/me/channel/green-room',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(GreenRoomSessionViewSchema, 'GreenRoomSession'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = PatchGreenRoomSessionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, state: true, greenRoomDefaultInvitePool: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const broadcast = await getActiveBroadcast(fastify.prisma, channel.id)
      if (!broadcast) return reply.status(409).send({ error: 'No active broadcast session' })

      await fastify.prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { greenRoomEnabled: parsed.data.enabled },
      })

      if (parsed.data.enabled) {
        await syncGreenRoomInvites(
          fastify.prisma,
          channel.id,
          user.id,
          broadcast.id,
          channel.greenRoomDefaultInvitePool,
        )
      }

      const [invites, candidates] = await Promise.all([
        listGreenRoomInvites(fastify.prisma, broadcast.id),
        listGreenRoomCandidates(
          fastify.prisma,
          channel.id,
          user.id,
          channel.greenRoomDefaultInvitePool,
        ),
      ])

      return reply.send({
        enabled: parsed.data.enabled,
        channelState: channel.state,
        invitePool: channel.greenRoomDefaultInvitePool,
        invites,
        candidates,
      })
    },
  )

  fastify.post(
    '/api/me/channel/green-room/sync',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(GreenRoomSessionViewSchema, 'GreenRoomSession'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, state: true, greenRoomDefaultInvitePool: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const broadcast = await getActiveBroadcast(fastify.prisma, channel.id)
      if (!broadcast) return reply.status(409).send({ error: 'No active broadcast session' })
      if (!broadcast.greenRoomEnabled) {
        return reply.status(409).send({ error: 'Green room is not enabled for this session' })
      }

      await syncGreenRoomInvites(
        fastify.prisma,
        channel.id,
        user.id,
        broadcast.id,
        channel.greenRoomDefaultInvitePool,
      )

      const [invites, candidates] = await Promise.all([
        listGreenRoomInvites(fastify.prisma, broadcast.id),
        listGreenRoomCandidates(
          fastify.prisma,
          channel.id,
          user.id,
          channel.greenRoomDefaultInvitePool,
        ),
      ])

      return reply.send({
        enabled: true,
        channelState: channel.state,
        invitePool: channel.greenRoomDefaultInvitePool,
        invites,
        candidates,
      })
    },
  )

  fastify.post(
    '/api/me/channel/green-room/invites',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponses([
          { status: 201, schema: GreenRoomInviteViewSchema, name: 'GreenRoomInvite' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = AddGreenRoomInviteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const broadcast = await getActiveBroadcast(fastify.prisma, channel.id)
      if (!broadcast) return reply.status(409).send({ error: 'No active broadcast session' })
      if (!broadcast.greenRoomEnabled) {
        return reply.status(409).send({ error: 'Enable green room before inviting guests' })
      }

      const target = await fastify.prisma.user.findUnique({
        where: { username: parsed.data.username },
        select: { id: true, username: true, displayName: true },
      })
      if (!target) return reply.status(404).send({ error: 'User not found' })
      if (target.id === user.id) {
        return reply.status(400).send({ error: 'Cannot invite yourself' })
      }

      const invite = await fastify.prisma.broadcastGreenRoomInvite.upsert({
        where: { broadcastId_userId: { broadcastId: broadcast.id, userId: target.id } },
        create: {
          broadcastId: broadcast.id,
          userId: target.id,
          source: 'MANUAL',
        },
        update: {},
        include: { user: { select: { id: true, username: true, displayName: true } } },
      })

      return reply.status(201).send({
        userId: invite.user.id,
        username: invite.user.username,
        displayName: invite.user.displayName,
        source: invite.source,
        invitedAt: invite.invitedAt.toISOString(),
        joinedAt: invite.joinedAt?.toISOString() ?? null,
      })
    },
  )

  fastify.delete(
    '/api/me/channel/green-room/invites/:userId',
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

      const broadcast = await getActiveBroadcast(fastify.prisma, channel.id)
      if (!broadcast) return reply.status(409).send({ error: 'No active broadcast session' })

      await fastify.prisma.broadcastGreenRoomInvite.deleteMany({
        where: { broadcastId: broadcast.id, userId },
      })

      return reply.status(204).send()
    },
  )
}

export default meGreenRoomRoutes
