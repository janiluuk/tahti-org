// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Public render feed for a channel's Channel Designer "Brand blocks" --
// distinct from routes/me/channel-blocks.ts (artist management). An ADDON
// block whose install has since been removed or disabled is silently
// dropped rather than sent broken; the artist's own management view still
// shows it so they can notice and replace/remove it.

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelBlockRenderListSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
  type ChannelBlockRenderItem,
} from '@tahti/shared'
import { addonSandboxUrl, resolveAddonVersionHash } from '../../lib/addons.js'

const channelBlocksRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/channels/:slug/blocks',
    {
      schema: {
        tags: ['channel-blocks'],
        response: openApiResponse(ChannelBlockRenderListSchema, 'ChannelBlockRenderList'),
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

      const rows = await fastify.prisma.channelBlock.findMany({
        where: { channelId: channel.id },
        orderBy: { position: 'asc' },
      })

      const context = {
        channelSlug: channel.slug,
        displayName: channel.user.displayName,
        isLive: channel.state === 'LIVE',
      }

      const blocks = (
        await Promise.all(
          rows.map(async (row): Promise<ChannelBlockRenderItem | null> => {
            if (row.type === 'LOGO') {
              const assetUrl = (row.configJson as { assetUrl?: string } | null)?.assetUrl
              if (!assetUrl) return null
              return {
                id: row.id,
                type: 'LOGO',
                width: row.width,
                position: row.position,
                assetUrl,
              }
            }

            const addonInstallId = (row.configJson as { addonInstallId?: string } | null)
              ?.addonInstallId
            if (!addonInstallId) return null
            const install = await fastify.prisma.addonInstall.findFirst({
              where: {
                id: addonInstallId,
                channelId: channel.id,
                enabled: true,
                widget: { status: 'APPROVED' },
              },
              include: { widget: true },
            })
            if (!install) return null
            const { version, bundleHash } = await resolveAddonVersionHash(
              fastify.prisma,
              install.widget,
              install.pinnedVersion,
            )
            return {
              id: row.id,
              type: 'ADDON',
              width: row.width,
              position: row.position,
              addon: {
                installId: install.id,
                widgetSlug: install.widget.slug,
                name: install.widget.name,
                sandboxUrl: addonSandboxUrl(bundleHash),
                version,
                position: row.position,
                config: install.configJson,
                context,
              },
            }
          }),
        )
      ).filter((block): block is ChannelBlockRenderItem => block !== null)

      return reply.send({ blocks })
    },
  )
}

export default channelBlocksRoutes
