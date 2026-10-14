// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  AssociationProfileSchema,
  CreateGovernanceAuditorSchema,
  EndGovernanceAuditorTermSchema,
  GovernanceAuditorListSchema,
  IdParamSchema,
  PatchAssociationProfileSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// The association's registered identity and contacts (name, business ID,
// register number, domicile, how to reach it). Members had no place to find
// these: nothing in the data model held them.

const FIELDS = [
  'name',
  'businessId',
  'registerNumber',
  'domicile',
  'contactEmail',
  'postalAddress',
  'website',
] as const

const AUDITOR_SELECT = {
  id: true,
  kind: true,
  deputy: true,
  name: true,
  firm: true,
  termStart: true,
  termEnd: true,
  meetingId: true,
} as const

async function loadProfile(prisma: PrismaClient) {
  const now = new Date()
  const [row, auditors] = await Promise.all([
    prisma.associationProfile.findUnique({ where: { id: 'default' } }),
    prisma.governanceAuditor.findMany({
      where: { termStart: { lte: now }, OR: [{ termEnd: null }, { termEnd: { gt: now } }] },
      orderBy: [{ kind: 'asc' }, { deputy: 'asc' }, { name: 'asc' }],
      select: AUDITOR_SELECT,
    }),
  ])
  return {
    ...Object.fromEntries(FIELDS.map((field) => [field, row?.[field] ?? null])),
    updatedAt: row?.updatedAt ?? null,
    auditors,
  }
}

const associationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/governance/association',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(AssociationProfileSchema, 'AssociationProfile'),
      },
    },
    async (_request, reply) => reply.send(await loadProfile(fastify.prisma)),
  )

  fastify.patch(
    '/api/admin/governance/association',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AssociationProfileSchema, 'AssociationProfile'),
      },
    },
    async (request, reply) => {
      const parsed = PatchAssociationProfileSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })

      const before = await fastify.prisma.associationProfile.findUnique({
        where: { id: 'default' },
      })
      const changed = FIELDS.filter(
        (field) => field in parsed.data && parsed.data[field] !== (before?.[field] ?? null),
      )
      if (changed.length > 0) {
        const data = {
          ...Object.fromEntries(changed.map((field) => [field, parsed.data[field]])),
          updatedById: request.sessionUser!.id,
        }
        await fastify.prisma.associationProfile.upsert({
          where: { id: 'default' },
          create: data,
          update: data,
        })
        await auditLog(fastify.prisma, {
          action: 'ASSOCIATION_PROFILE_UPDATE',
          actorId: request.sessionUser!.id,
          targetId: 'default',
          meta: { changed },
        })
      }
      return reply.send(await loadProfile(fastify.prisma))
    },
  )

  // Auditors and operations inspectors, past and present. Only the board
  // records them; members see the current ones on the association profile.
  fastify.get(
    '/api/admin/governance/auditors',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceAuditorListSchema, 'GovernanceAuditorList'),
      },
    },
    async (_request, reply) =>
      reply.send(
        await fastify.prisma.governanceAuditor.findMany({
          orderBy: [{ termStart: 'desc' }, { name: 'asc' }],
          select: AUDITOR_SELECT,
        }),
      ),
  )

  fastify.post(
    '/api/admin/governance/auditors',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          {
            status: 201,
            schema: GovernanceAuditorListSchema.element,
            name: 'GovernanceAuditor',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = CreateGovernanceAuditorSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      if (parsed.data.meetingId) {
        const meeting = await fastify.prisma.governanceMeeting.findUnique({
          where: { id: parsed.data.meetingId },
          select: { id: true },
        })
        if (!meeting) return reply.status(400).send({ error: 'Meeting not found' })
      }
      const auditor = await fastify.prisma.governanceAuditor.create({
        data: { ...parsed.data, createdById: request.sessionUser!.id },
        select: AUDITOR_SELECT,
      })
      await auditLog(fastify.prisma, {
        action: 'AUDITOR_APPOINT',
        actorId: request.sessionUser!.id,
        targetId: auditor.id,
        meta: { name: auditor.name, kind: auditor.kind, deputy: auditor.deputy },
      })
      return reply.status(201).send(auditor)
    },
  )

  fastify.patch(
    '/api/admin/governance/auditors/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceAuditorListSchema.element, 'GovernanceAuditor'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = EndGovernanceAuditorTermSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const existing = await fastify.prisma.governanceAuditor.findUnique({ where: { id } })
      if (!existing) return reply.status(404).send({ error: 'Auditor not found' })
      if (parsed.data.termEnd <= existing.termStart) {
        return reply.status(400).send({ error: 'The term must end after it starts' })
      }
      const auditor = await fastify.prisma.governanceAuditor.update({
        where: { id },
        data: { termEnd: parsed.data.termEnd },
        select: AUDITOR_SELECT,
      })
      if (existing.termEnd?.getTime() !== parsed.data.termEnd.getTime()) {
        await auditLog(fastify.prisma, {
          action: 'AUDITOR_TERM_END',
          actorId: request.sessionUser!.id,
          targetId: id,
          meta: { name: existing.name, termEnd: parsed.data.termEnd },
        })
      }
      return reply.send(auditor)
    },
  )
}

export default associationRoutes
