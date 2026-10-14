// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  GovernanceDocumentLegalHoldSchema,
  GovernanceDocumentListSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { documentResponse } from '../../lib/governance-documents.js'

// A legal hold keeps a governance document exactly as it is while a dispute,
// an audit or an authority's request is pending: it cannot be edited or
// archived until the board lifts the hold.

const governanceDocumentHoldRoutes: FastifyPluginAsync = async (fastify) => {
  async function respond(id: string) {
    const document = await fastify.prisma.governanceDocument.findUniqueOrThrow({
      where: { id },
      include: { supersededBy: { select: { id: true } } },
    })
    return documentResponse(document)
  }

  fastify.put(
    '/api/admin/governance/documents/:id/legal-hold',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceDocumentListSchema.element, 'GovernanceDocument'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = GovernanceDocumentLegalHoldSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })

      const existing = await fastify.prisma.governanceDocument.findUnique({
        where: { id },
        select: { title: true, legalHoldAt: true, legalHoldReason: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Document not found' })
      if (existing.legalHoldReason !== parsed.data.reason) {
        await fastify.prisma.governanceDocument.update({
          where: { id },
          data: {
            legalHoldAt: existing.legalHoldAt ?? new Date(),
            legalHoldReason: parsed.data.reason,
          },
        })
        await auditLog(fastify.prisma, {
          action: 'DOCUMENT_LEGAL_HOLD',
          actorId: request.sessionUser!.id,
          targetId: id,
          meta: { title: existing.title, held: true, reason: parsed.data.reason },
        })
      }
      return reply.send(await respond(id))
    },
  )

  fastify.delete(
    '/api/admin/governance/documents/:id/legal-hold',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceDocumentListSchema.element, 'GovernanceDocument'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const existing = await fastify.prisma.governanceDocument.findUnique({
        where: { id },
        select: { title: true, legalHoldAt: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Document not found' })
      if (existing.legalHoldAt) {
        await fastify.prisma.governanceDocument.update({
          where: { id },
          data: { legalHoldAt: null, legalHoldReason: null },
        })
        await auditLog(fastify.prisma, {
          action: 'DOCUMENT_LEGAL_HOLD',
          actorId: request.sessionUser!.id,
          targetId: id,
          meta: { title: existing.title, held: false },
        })
      }
      return reply.send(await respond(id))
    },
  )
}

export default governanceDocumentHoldRoutes
