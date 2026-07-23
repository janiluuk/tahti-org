// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminForceOfflineResponseSchema,
  ChannelProgrammePatchSchema,
  ChannelProgrammePromoteSchema,
  ChannelProgrammeViewSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
  SlugParamSchema,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { forceChannelOffline } from '../../lib/force-channel-offline.js'
import {
  applyProgrammePatch,
  fetchProgrammeView,
  promoteReleaseTrackToProgramme,
} from '../../lib/programme.js'

// M21-C: force a live channel offline (orchestrator stop + broadcast end + audit)
const adminChannelsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/admin/channels/:slug/force-offline',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-C: stop Liquidsoap, end broadcast, set channel OFFLINE',
        response: openApiResponses([
          { status: 200, schema: AdminForceOfflineResponseSchema, name: 'Ok' },
        ]),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, state: true, userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (channel.state === 'OFFLINE') {
        return reply.status(409).send({ error: 'Channel is not live' })
      }

      await forceChannelOffline(fastify.prisma, fastify.log, {
        channelId: channel.id,
        slug,
      })

      await auditLog(fastify.prisma, {
        action: 'STREAM_FORCE_OFFLINE',
        actorId: actor.id,
        targetId: channel.userId,
        meta: { channelId: channel.id, slug },
      })

      return reply.send({ ok: true as const, channelId: channel.id, slug })
    },
  )

  // Board access to any artist's 24/7 rotation editor — mirrors /api/me/channel/programme's
  // three endpoints exactly, scoped by :slug (requireBoard) instead of the session user.
  fastify.get(
    '/api/admin/channels/:slug/programme',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: "Board access to any channel's 24/7 rotation (offline playback order)",
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, channel.userId))
    },
  )

  fastify.patch(
    '/api/admin/channels/:slug/programme',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const parsed = ChannelProgrammePatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      if (
        parsed.data.fallbackMode === undefined &&
        parsed.data.fallbackEnabled === undefined &&
        parsed.data.fallbackAutoEnroll === undefined &&
        parsed.data.items === undefined
      ) {
        return reply.status(400).send({
          error: 'fallbackMode, fallbackEnabled, fallbackAutoEnroll, or items required',
        })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { error } = await applyProgrammePatch(fastify.prisma, channel.id, parsed.data)
      if (error) return reply.status(400).send({ error })

      return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, channel.userId))
    },
  )

  fastify.post(
    '/api/admin/channels/:slug/programme/library',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: "Board access: add a release track to any channel's 24/7 rotation",
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const parsed = ChannelProgrammePromoteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { error } = await promoteReleaseTrackToProgramme(
        fastify.prisma,
        channel,
        parsed.data.releaseTrackId,
      )
      if (error)
        return reply.status(error === 'Release track not found' ? 404 : 400).send({ error })

      return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, channel.userId))
    },
  )
}

export default adminChannelsRoutes
