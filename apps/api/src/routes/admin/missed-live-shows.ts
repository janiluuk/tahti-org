// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MissedLiveShowFlagIdParamSchema,
  MissedLiveShowFlagListQuerySchema,
  MissedLiveShowFlagListSchema,
  MissedLiveShowFlagPatchSchema,
  MissedLiveShowFlagViewSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

const adminMissedLiveShowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/missed-live-shows',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(MissedLiveShowFlagListSchema, 'MissedLiveShowFlagList'),
      },
    },
    async (request, reply) => {
      const parsed = MissedLiveShowFlagListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message })
      }

      const flags = await fastify.prisma.missedLiveShowFlag.findMany({
        where: parsed.data.status ? { status: parsed.data.status } : undefined,
        orderBy: { detectedAt: 'desc' },
        take: parsed.data.limit,
        include: {
          scheduledLiveShow: { select: { id: true, title: true, startAt: true } },
          channel: {
            select: {
              slug: true,
              user: { select: { id: true, username: true, displayName: true } },
            },
          },
        },
      })

      return reply.send({
        flags: flags.map((f) => ({
          id: f.id.toString(),
          status: f.status,
          detectedAt: f.detectedAt.toISOString(),
          resolutionNote: f.resolutionNote,
          resolvedAt: f.resolvedAt?.toISOString() ?? null,
          scheduledLiveShow: {
            id: f.scheduledLiveShow.id,
            title: f.scheduledLiveShow.title,
            startAt: f.scheduledLiveShow.startAt.toISOString(),
          },
          channel: {
            slug: f.channel.slug,
            userId: f.channel.user.id,
            username: f.channel.user.username,
            displayName: f.channel.user.displayName,
          },
        })),
      })
    },
  )

  fastify.patch(
    '/api/admin/missed-live-shows/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(MissedLiveShowFlagViewSchema, 'MissedLiveShowFlagView'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(MissedLiveShowFlagIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = MissedLiveShowFlagPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message })
      }

      const existing = await fastify.prisma.missedLiveShowFlag.findUnique({
        where: { id: routeParams.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Flag not found' })

      const isResolving = parsed.data.status !== 'OPEN' && parsed.data.status !== 'REVIEWING'
      const updated = await fastify.prisma.missedLiveShowFlag.update({
        where: { id: existing.id },
        data: {
          status: parsed.data.status,
          resolutionNote: parsed.data.resolutionNote ?? existing.resolutionNote,
          resolvedById: isResolving ? request.sessionUser!.id : null,
          resolvedAt: isResolving ? new Date() : null,
        },
        include: {
          scheduledLiveShow: { select: { id: true, title: true, startAt: true } },
          channel: {
            select: {
              slug: true,
              user: { select: { id: true, username: true, displayName: true } },
            },
          },
        },
      })

      return reply.send({
        id: updated.id.toString(),
        status: updated.status,
        detectedAt: updated.detectedAt.toISOString(),
        resolutionNote: updated.resolutionNote,
        resolvedAt: updated.resolvedAt?.toISOString() ?? null,
        scheduledLiveShow: {
          id: updated.scheduledLiveShow.id,
          title: updated.scheduledLiveShow.title,
          startAt: updated.scheduledLiveShow.startAt.toISOString(),
        },
        channel: {
          slug: updated.channel.slug,
          userId: updated.channel.user.id,
          username: updated.channel.user.username,
          displayName: updated.channel.user.displayName,
        },
      })
    },
  )
}

export default adminMissedLiveShowRoutes
