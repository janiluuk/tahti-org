// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelProgrammePatchSchema,
  ChannelProgrammePromoteSchema,
  ChannelProgrammeViewSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  applyProgrammePatch,
  fetchProgrammeView,
  promoteReleaseTrackToProgramme,
} from '../../lib/programme.js'

const meProgrammeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/programme',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: fallback programme (offline playback order)',
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, user.id))
    },
  )

  fastify.patch(
    '/api/me/channel/programme',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
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
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { error } = await applyProgrammePatch(fastify.prisma, channel.id, parsed.data)
      if (error) return reply.status(400).send({ error })

      return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, user.id))
    },
  )

  // M33: pull a published release track into the 24/7 rotation alongside archive sets.
  fastify.post(
    '/api/me/channel/programme/library',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M33: add a release track to the 24/7 rotation',
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ChannelProgrammePromoteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
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

      return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, user.id))
    },
  )
}

export default meProgrammeRoutes
