// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  AssociationProfileSchema,
  PatchAssociationProfileSchema,
  openApiResponse,
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

async function loadProfile(prisma: PrismaClient) {
  const row = await prisma.associationProfile.findUnique({ where: { id: 'default' } })
  return {
    ...Object.fromEntries(FIELDS.map((field) => [field, row?.[field] ?? null])),
    updatedAt: row?.updatedAt ?? null,
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
}

export default associationRoutes
