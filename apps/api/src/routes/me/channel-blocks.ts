// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Artist-owned Channel Designer blocks (logo + addon layout) plus the public
// render feed. Existing Designer look sections stay on Channel columns; this
// is additive layout only. Addon *installs* remain in routes/me/addons.ts —
// a block references an install id, it does not create one.

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  ChannelBlockListSchema,
  ChannelBlockViewSchema,
  CreateChannelBlockSchema,
  IdParamSchema,
  MAX_CHANNEL_BLOCKS,
  PatchChannelBlockSchema,
  PublicChannelBlockListSchema,
  ReorderChannelBlocksSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireArtist } from '../../plugins/auth.js'
import {
  emptyPublicChannelBlock,
  parseAddonBlockConfig,
  parseLogoBlockConfig,
  resolveLogoBlockUrl,
  sandboxUrlForBundle,
} from '../../lib/channel-blocks.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const BLOCK_ORDER = [{ position: 'asc' as const }, { createdAt: 'asc' as const }]

const meChannelBlockRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/blocks',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelBlockListSchema, 'ChannelBlockList'),
      },
    },
    async (request, reply) => {
      const blocks = await fastify.prisma.channelBlock.findMany({
        where: { channelId: request.channel!.id },
        orderBy: BLOCK_ORDER,
      })
      return reply.send({ blocks })
    },
  )

  fastify.post(
    '/api/me/channel/blocks',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelBlockViewSchema, 'ChannelBlockView'),
      },
    },
    async (request, reply) => {
      const parsed = CreateChannelBlockSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const channelId = request.channel!.id
      const count = await fastify.prisma.channelBlock.count({ where: { channelId } })
      if (count >= MAX_CHANNEL_BLOCKS) {
        return reply.status(400).send({ error: `At most ${MAX_CHANNEL_BLOCKS} blocks per channel` })
      }

      if (parsed.data.type === 'ADDON') {
        const install = await fastify.prisma.addonInstall.findFirst({
          where: { id: parsed.data.configJson.addonInstallId, channelId },
        })
        if (!install) return reply.status(404).send({ error: 'Addon install not found' })
        const existingAddonBlocks = await fastify.prisma.channelBlock.findMany({
          where: { channelId, type: 'ADDON' },
          select: { configJson: true },
        })
        const alreadyPlaced = existingAddonBlocks.some(
          (block) => parseAddonBlockConfig(block.configJson)?.addonInstallId === install.id,
        )
        if (alreadyPlaced) {
          return reply.status(409).send({ error: 'Addon already placed as a block' })
        }
      }

      const block = await fastify.prisma.channelBlock.create({
        data: {
          channelId,
          type: parsed.data.type,
          width: parsed.data.width ?? 'FULL',
          position: count,
          configJson: parsed.data.configJson as Prisma.InputJsonValue,
        },
      })
      return reply.status(201).send(block)
    },
  )

  fastify.put(
    '/api/me/channel/blocks/reorder',
    { preHandler: requireArtist, schema: { tags: ['channel'] } },
    async (request, reply) => {
      const parsed = ReorderChannelBlocksSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const channelId = request.channel!.id
      const owned = await fastify.prisma.channelBlock.findMany({
        where: { id: { in: parsed.data.ids }, channelId },
        select: { id: true },
      })
      const ownedIds = new Set(owned.map((block) => block.id))
      if (ownedIds.size !== parsed.data.ids.length) {
        return reply.status(404).send({ error: 'Block not found' })
      }

      await fastify.prisma.$transaction(
        parsed.data.ids.map((id, position) =>
          fastify.prisma.channelBlock.update({ where: { id }, data: { position } }),
        ),
      )
      return reply.status(204).send()
    },
  )

  fastify.patch(
    '/api/me/channel/blocks/:id',
    { preHandler: requireArtist },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchChannelBlockSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.channelBlock.findFirst({
        where: { id: routeParams.id, channelId: request.channel!.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Block not found' })

      if (parsed.data.configJson) {
        if (existing.type === 'LOGO' && !parseLogoBlockConfig(parsed.data.configJson)) {
          return reply.status(400).send({ error: 'LOGO blocks require { assetId, url }' })
        }
        if (existing.type === 'ADDON') {
          const addonConfig = parseAddonBlockConfig(parsed.data.configJson)
          if (!addonConfig) {
            return reply.status(400).send({ error: 'ADDON blocks require { addonInstallId }' })
          }
          const install = await fastify.prisma.addonInstall.findFirst({
            where: { id: addonConfig.addonInstallId, channelId: request.channel!.id },
          })
          if (!install) return reply.status(404).send({ error: 'Addon install not found' })
        }
      }

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
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.channelBlock.deleteMany({
        where: { id: routeParams.id, channelId: request.channel!.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Block not found' })
      return reply.status(204).send()
    },
  )

  // Public render feed — no auth. Orphan / disabled addon blocks are omitted.
  fastify.get(
    '/api/v1/channels/:slug/blocks',
    {
      schema: {
        tags: ['channel'],
        response: openApiResponse(PublicChannelBlockListSchema, 'PublicChannelBlockList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, slug: true, state: true, user: { select: { displayName: true } } },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const stored = await fastify.prisma.channelBlock.findMany({
        where: { channelId: channel.id },
        orderBy: BLOCK_ORDER,
      })

      const addonInstallIds = stored
        .filter((block) => block.type === 'ADDON')
        .map((block) => parseAddonBlockConfig(block.configJson)?.addonInstallId)
        .filter((id): id is string => Boolean(id))

      const installs =
        addonInstallIds.length === 0
          ? []
          : await fastify.prisma.addonInstall.findMany({
              where: {
                id: { in: addonInstallIds },
                channelId: channel.id,
                enabled: true,
                widget: { status: 'APPROVED' },
              },
              include: { widget: true },
            })
      const installById = new Map(installs.map((install) => [install.id, install]))
      const context = {
        channelSlug: channel.slug,
        displayName: channel.user.displayName,
        isLive: channel.state === 'LIVE',
      }

      const blocks = []
      for (const block of stored) {
        if (block.type === 'LOGO') {
          const logoUrl = resolveLogoBlockUrl(block.configJson)
          if (!logoUrl) continue
          blocks.push({
            ...emptyPublicChannelBlock(block),
            logoUrl,
          })
          continue
        }

        const addonConfig = parseAddonBlockConfig(block.configJson)
        const install = addonConfig ? installById.get(addonConfig.addonInstallId) : undefined
        if (!install) continue
        blocks.push({
          ...emptyPublicChannelBlock(block),
          addon: {
            installId: install.id,
            widgetSlug: install.widget.slug,
            name: install.widget.name,
            sandboxUrl: sandboxUrlForBundle(install.widget.bundleHash),
            version: install.widget.currentVersion,
            position: block.position,
            config: install.configJson,
            context,
          },
        })
      }

      return reply.send({ blocks })
    },
  )
}

export default meChannelBlockRoutes
