// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminResolutionCreateSchema,
  AdminResolutionListQuerySchema,
  AdminResolutionListSchema,
  AdminResolutionPatchSchema,
  AdminResolutionRowSchema,
  ResolutionIdParamSchema,
  openApiResponse,
  openApiResponses,
  outcomeMatchesVotes,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

const adminResolutionsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/resolutions',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminResolutionListSchema, 'AdminResolutionList'),
      },
    },
    async (request, reply) => {
      const parsed = AdminResolutionListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }

      const rows = await fastify.prisma.boardResolution.findMany({
        where: parsed.data.publishedOnly ? { publishedAt: { not: null } } : undefined,
        orderBy: { votedAt: 'desc' },
        take: 100,
        include: { createdBy: { select: { displayName: true } } },
      })

      return reply.send(
        rows.map((r) => ({
          id: r.id.toString(),
          title: r.title,
          body: r.body,
          votedAt: r.votedAt,
          outcome: r.outcome,
          voteFor: r.voteFor,
          voteAgainst: r.voteAgainst,
          voteAbstain: r.voteAbstain,
          publishedAt: r.publishedAt,
          createdAt: r.createdAt,
          createdByDisplayName: r.createdBy.displayName,
        })),
      )
    },
  )

  fastify.post(
    '/api/admin/resolutions',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          { status: 201, schema: AdminResolutionRowSchema, name: 'AdminResolutionRow' },
        ]),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const parsed = AdminResolutionCreateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }
      const body = parsed.data

      const row = await fastify.prisma.boardResolution.create({
        data: {
          title: body.title,
          body: body.body,
          votedAt: body.votedAt,
          outcome: body.outcome,
          voteFor: body.voteFor,
          voteAgainst: body.voteAgainst,
          voteAbstain: body.voteAbstain,
          createdById: actor.id,
        },
        include: { createdBy: { select: { displayName: true } } },
      })

      return reply.status(201).send({
        id: row.id.toString(),
        title: row.title,
        body: row.body,
        votedAt: row.votedAt,
        outcome: row.outcome,
        voteFor: row.voteFor,
        voteAgainst: row.voteAgainst,
        voteAbstain: row.voteAbstain,
        publishedAt: row.publishedAt,
        createdAt: row.createdAt,
        createdByDisplayName: row.createdBy.displayName,
      })
    },
  )

  fastify.patch(
    '/api/admin/resolutions/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminResolutionRowSchema, 'AdminResolutionRow'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(ResolutionIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const parsed = AdminResolutionPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const existing = await fastify.prisma.boardResolution.findUnique({ where: { id } })
      if (!existing) return reply.status(404).send({ error: 'Resolution not found' })

      if (parsed.data.outcome) {
        const outcomeCheck = outcomeMatchesVotes({
          outcome: parsed.data.outcome,
          voteFor: existing.voteFor,
          voteAgainst: existing.voteAgainst,
        })
        if (!outcomeCheck) {
          return reply.status(400).send({
            error: 'outcome does not match the recorded vote counts for this resolution',
          })
        }
      }

      const row = await fastify.prisma.boardResolution.update({
        where: { id },
        data: parsed.data,
        include: { createdBy: { select: { displayName: true } } },
      })

      return reply.send({
        id: row.id.toString(),
        title: row.title,
        body: row.body,
        votedAt: row.votedAt,
        outcome: row.outcome,
        voteFor: row.voteFor,
        voteAgainst: row.voteAgainst,
        voteAbstain: row.voteAbstain,
        publishedAt: row.publishedAt,
        createdAt: row.createdAt,
        createdByDisplayName: row.createdBy.displayName,
      })
    },
  )
}

export default adminResolutionsRoutes
