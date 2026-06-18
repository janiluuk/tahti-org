// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MetaStreamOptResponseSchema,
  MetaStreamOptSchema,
  ProfileFieldsSchema,
  ProfilePatchSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { recordMentions } from '../../lib/mentions.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

// PATCH /api/me/profile — update bio, display name, social links, tip jar, meta-stream opt-out
const meProfileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.patch(
    '/api/me/profile',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ProfileFieldsSchema, 'ProfileFields'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ProfilePatchSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {}

      if (body.displayName !== undefined) data.displayName = body.displayName
      if (body.bio !== undefined) data.bio = body.bio.trim() || null
      if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl.trim() || null
      if (body.tipJarUrl !== undefined) data.tipJarUrl = body.tipJarUrl.trim() || null
      if (body.countryCode !== undefined) data.countryCode = body.countryCode?.toUpperCase() ?? null
      if (body.socialLinks !== undefined) data.socialLinks = body.socialLinks
      if (body.publicAttribution !== undefined) data.publicAttribution = body.publicAttribution

      const updated = await fastify.prisma.user.update({
        where: { id: user.id },
        data,
        select: {
          id: true,
          username: true,
          displayName: true,
          bio: true,
          avatarUrl: true,
          tipJarUrl: true,
          countryCode: true,
          socialLinks: true,
          publicAttribution: true,
        },
      })

      if (body.bio) {
        recordMentions(fastify.prisma, user.id, body.bio, 'BIO', user.id).catch((e) =>
          fastify.log.warn(e, 'mention record failed'),
        )
      }

      return reply.send(updated)
    },
  )

  // GET /api/me/channel/meta-stream — current opt-out state
  fastify.get(
    '/api/me/channel/meta-stream',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(MetaStreamOptResponseSchema, 'MetaStreamOpt'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { metaStreamOptOut: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      return reply.send({ metaStreamOptOut: channel.metaStreamOptOut })
    },
  )

  // PATCH /api/me/channel/meta-stream — toggle Tahti Radio opt-out
  fastify.patch(
    '/api/me/channel/meta-stream',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(MetaStreamOptResponseSchema, 'MetaStreamOpt'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = MetaStreamOptSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const { optOut } = parsed.data

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { metaStreamOptOut: optOut },
      })

      return reply.send({ metaStreamOptOut: optOut })
    },
  )
}

export default meProfileRoutes
