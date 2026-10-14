// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
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
import { auditLog } from '../../lib/audit.js'
import { userName } from '../../lib/safe-names.js'
import { resolveAgendaLinks } from '../../lib/agenda-links.js'

type ResolutionWithCreator = Prisma.BoardResolutionGetPayload<{
  include: { createdBy: { select: { username: true; displayName: true } } }
}>

function resolutionRow(row: ResolutionWithCreator) {
  return {
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
    createdByDisplayName: userName(row.createdBy),
    meetingId: row.meetingId,
    agendaItemId: row.agendaItemId,
    binding: row.binding,
  }
}

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
        include: { createdBy: { select: { username: true, displayName: true } } },
      })

      return reply.send(rows.map(resolutionRow))
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

      const links = await resolveAgendaLinks(fastify.prisma, body, {
        meetingId: null,
        agendaItemId: null,
      })
      if ('error' in links) return reply.status(400).send({ error: links.error })

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
          meetingId: links.meetingId,
          agendaItemId: links.agendaItemId,
          binding: body.binding,
        },
        include: { createdBy: { select: { username: true, displayName: true } } },
      })

      await auditLog(fastify.prisma, {
        action: 'RESOLUTION_CREATE',
        actorId: actor.id,
        targetId: row.id.toString(),
        meta: {
          title: row.title,
          outcome: row.outcome,
          meetingId: row.meetingId,
          agendaItemId: row.agendaItemId,
          binding: row.binding,
        },
      })

      return reply.status(201).send(resolutionRow(row))
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

      const links = await resolveAgendaLinks(fastify.prisma, parsed.data, existing)
      if ('error' in links) return reply.status(400).send({ error: links.error })

      const row = await fastify.prisma.boardResolution.update({
        where: { id },
        data: { ...parsed.data, ...links },
        include: { createdBy: { select: { username: true, displayName: true } } },
      })

      await auditLog(fastify.prisma, {
        action: 'RESOLUTION_UPDATE',
        actorId: request.sessionUser!.id,
        targetId: row.id.toString(),
        meta: {
          title: row.title,
          outcome: row.outcome,
          published: Boolean(row.publishedAt),
          meetingId: row.meetingId,
          agendaItemId: row.agendaItemId,
          binding: row.binding,
        },
      })

      return reply.send(resolutionRow(row))
    },
  )
}

export default adminResolutionsRoutes
