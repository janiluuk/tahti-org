// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Artist-owned CRUD for Channel Designer "Brand blocks" (logo, addon).
// Row-packing for display is computed from (position order, width) by
// packBlocks in @tahti/shared -- this route only persists the flat list,
// same shape as routes/me/addons.ts's channel-install routes.

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  ChannelBlockIdParamSchema,
  ChannelBlockListSchema,
  ChannelBlockViewSchema,
  CreateChannelBlockSchema,
  PatchChannelBlockSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireArtist } from '../../plugins/auth.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const meChannelBlocksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/blocks',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['channel-blocks'],
        response: openApiResponse(ChannelBlockListSchema, 'ChannelBlockList'),
      },
    },
    async (request, reply) => {
      const blocks = await fastify.prisma.channelBlock.findMany({
        where: { channelId: request.channel!.id },
        orderBy: { position: 'asc' },
      })
      return reply.send({ blocks })
    },
  )

  fastify.post(
    '/api/me/channel/blocks',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['channel-blocks'],
        response: openApiResponse(ChannelBlockViewSchema, 'ChannelBlockView'),
      },
    },
    async (request, reply) => {
      const parsed = CreateChannelBlockSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const position = await fastify.prisma.channelBlock.count({
        where: { channelId: request.channel!.id },
      })

      const block = await fastify.prisma.channelBlock.create({
        data: {
          channelId: request.channel!.id,
          type: parsed.data.type,
          width: parsed.data.width,
          position,
          configJson: parsed.data.configJson as Prisma.InputJsonValue,
        },
      })
      return reply.status(201).send(block)
    },
  )

  fastify.patch(
    '/api/me/channel/blocks/:id',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['channel-blocks'],
        response: openApiResponse(ChannelBlockViewSchema, 'ChannelBlockView'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(ChannelBlockIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchChannelBlockSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.channelBlock.findFirst({
        where: { id: routeParams.id, channelId: request.channel!.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Block not found' })

      const block = await fastify.prisma.channelBlock.update({
        where: { id: routeParams.id },
        data: {
          ...(parsed.data.width !== undefined ? { width: parsed.data.width } : {}),
          ...(parsed.data.position !== undefined ? { position: parsed.data.position } : {}),
          ...(parsed.data.configJson !== undefined
            ? { configJson: parsed.data.configJson as Prisma.InputJsonValue }
            : {}),
        },
      })
      return reply.send(block)
    },
  )

  fastify.delete(
    '/api/me/channel/blocks/:id',
    { preHandler: requireArtist },
    async (request, reply) => {
      const routeParams = parseRouteParams(ChannelBlockIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.channelBlock.deleteMany({
        where: { id: routeParams.id, channelId: request.channel!.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Block not found' })
      return reply.status(204).send()
    },
  )
}

export default meChannelBlocksRoutes
