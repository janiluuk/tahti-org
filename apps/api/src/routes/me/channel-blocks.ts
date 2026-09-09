// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Artist-owned CRUD for Channel Designer "Brand blocks" (logo, addon).
// Row-packing for display is computed from (position order, width) by
// packBlocks in @tahti/shared -- this route only persists the flat list,
// same shape as routes/me/addons.ts's channel-install routes.

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import { nanoid } from 'nanoid'
import {
  ChannelBlockIdParamSchema,
  ChannelBlockListSchema,
  ChannelBlockViewSchema,
  CreateChannelBlockSchema,
  ImageUploadCompleteResponseSchema,
  ImageUploadCompleteSchema,
  ImageUploadPrepareResponseSchema,
  LogoUploadPrepareSchema,
  PatchChannelBlockSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireArtist } from '../../plugins/auth.js'
import { presignedPutUrl } from '../../lib/minio.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'

const PRESIGN_TTL_SEC = 900

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

  // LOGO block image upload — same presigned-PUT flow as the avatar/profile-logo
  // pipeline (routes/me/avatar.ts), PNG/WebP only so alpha is preserved, but its
  // own `channel-blocks/` key space since a block's logo is a distinct asset from
  // the User.logoUrl overlay stamp. complete() only resolves uploadKey -> a public
  // URL (no DB write) — the caller persists it via POST/PATCH .../blocks with
  // configJson: { assetUrl }, same as the manual-URL path already supported.
  fastify.post(
    '/api/me/channel/blocks/logo/prepare',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['channel-blocks'],
        response: openApiResponse(ImageUploadPrepareResponseSchema, 'ChannelBlockLogoUploadPrepare'),
      },
    },
    async (request, reply) => {
      const parsed = LogoUploadPrepareSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const ext = parsed.data.contentType === 'image/webp' ? 'webp' : 'png'
      const uploadKey = `channel-blocks/${request.sessionUser!.username}/logo-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/channel/blocks/logo/complete',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['channel-blocks'],
        response: openApiResponse(ImageUploadCompleteResponseSchema, 'ChannelBlockLogoUploadComplete'),
      },
    },
    async (request, reply) => {
      const parsed = ImageUploadCompleteSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const prefix = `channel-blocks/${request.sessionUser!.username}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this account' })
      }

      const url = publicMediaUrl(parsed.data.uploadKey)
      if (!url) return reply.status(500).send({ error: 'Failed to resolve logo URL' })

      return reply.send({ url })
    },
  )
}

export default meChannelBlocksRoutes
