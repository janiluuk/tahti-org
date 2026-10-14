// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  SoundShareListSchema,
  SoundShareViewSchema,
  openApiNoContentResponse,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { requireAuth } from '../../plugins/auth.js'

const MAX_SHARES_PER_SOUND = 50

const CreateSoundShareSchema = z.object({
  granteeUsername: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, '').toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9_-]{2,32}$/, 'Invalid username'))
    .optional(),
  permission: z.enum(['READ', 'DOWNLOAD']).default('READ'),
  expiresInDays: z.number().int().min(1).max(365).optional(),
})

const ShareIdParamSchema = z.object({ shareId: z.string().min(1).max(64) })

type ShareRow = {
  id: string
  granteeUsername: string | null
  token: string
  permission: string
  expiresAt: Date | null
  createdAt: Date
}

function serializeShare(share: ShareRow) {
  return {
    id: share.id,
    granteeUsername: share.granteeUsername,
    token: share.token,
    permission: share.permission,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
  }
}

const meSoundShareRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/sound/:id/shares — active share links for one of your sounds
  fastify.get(
    '/api/me/sound/:id/shares',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        summary: "List a sound's keyed share links",
        description: "Active keyed share links (`/t/:id?key=`) for one of the caller's sounds.",
        response: openApiResponse(SoundShareListSchema, 'SoundShareList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const sound = await fastify.prisma.sound.findFirst({
        where: { id: routeParams.id, channel: { userId: user.id } },
        select: { id: true },
      })
      if (!sound) return reply.status(404).send({ error: 'Sound item not found' })

      const shares = await fastify.prisma.soundShare.findMany({
        where: {
          soundId: sound.id,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: 'asc' },
      })
      return reply.send({ shares: shares.map(serializeShare) })
    },
  )

  // POST /api/me/sound/:id/share — mint a keyed link (/t/:id?key=<token>)
  fastify.post(
    '/api/me/sound/:id/share',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        summary: 'Create a keyed share link for a sound',
        description:
          "Mints `/t/:id?key=` for one of the caller's sounds. Answers 201. JSON body is validated in the handler, not by Fastify AJV.",
        response: openApiResponses([
          { status: 201, schema: SoundShareViewSchema, name: 'SoundShareView' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = CreateSoundShareSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { granteeUsername, permission, expiresInDays } = parsed.data

      const sound = await fastify.prisma.sound.findFirst({
        where: { id: routeParams.id, channel: { userId: user.id } },
        select: { id: true, _count: { select: { shares: true } } },
      })
      if (!sound) return reply.status(404).send({ error: 'Sound item not found' })
      if (sound._count.shares >= MAX_SHARES_PER_SOUND) {
        return reply
          .status(400)
          .send({ error: `A sound can have at most ${MAX_SHARES_PER_SOUND} share links` })
      }

      if (granteeUsername) {
        const grantee = await fastify.prisma.user.findUnique({
          where: { username: granteeUsername },
          select: { id: true },
        })
        if (!grantee) return reply.status(404).send({ error: 'No member with that username' })
      }

      const share = await fastify.prisma.soundShare.create({
        data: {
          soundId: sound.id,
          granteeUsername: granteeUsername ?? null,
          token: nanoid(32),
          permission,
          expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
        },
      })
      return reply.status(201).send(serializeShare(share))
    },
  )

  // DELETE /api/me/sound/shares/:shareId — revoke a link
  fastify.delete(
    '/api/me/sound/shares/:shareId',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        summary: 'Revoke a sound share link',
        description: 'Deletes one keyed share the caller owns. Answers 204.',
        response: openApiNoContentResponse(),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ShareIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const share = await fastify.prisma.soundShare.findFirst({
        where: { id: routeParams.shareId, sound: { channel: { userId: user.id } } },
        select: { id: true },
      })
      if (!share) return reply.status(404).send({ error: 'Share not found' })

      await fastify.prisma.soundShare.delete({ where: { id: share.id } })
      return reply.status(204).send()
    },
  )
}

export default meSoundShareRoutes
