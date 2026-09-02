// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  ChannelVisualPresetResponseSchema,
  ChannelVisualPresetSaveSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

function toDto(row: {
  id: string
  name: string
  settingsJson: string
  createdAt: Date
  updatedAt: Date
}) {
  let settings: Record<string, unknown> = {}
  try {
    settings = JSON.parse(row.settingsJson) as Record<string, unknown>
  } catch {
    settings = {}
  }
  return {
    id: row.id,
    name: row.name,
    settings,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Named "Look" presets a channel owner can save and re-apply from the
 * Channel Designer — a small library of full-settings snapshots distinct
 * from the single live look on `Channel` itself (PATCH /api/me/channel/visual).
 * Saving under a name that already exists overwrites that preset in place. */
const meChannelVisualPresetsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/visual-presets',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(
          z.array(ChannelVisualPresetResponseSchema),
          'ChannelVisualPresetList',
        ),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const presets = await fastify.prisma.channelVisualPreset.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(presets.map(toDto))
    },
  )

  fastify.post(
    '/api/me/channel/visual-presets',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelVisualPresetResponseSchema, 'ChannelVisualPreset'),
      },
    },
    async (request, reply) => {
      const parsed = ChannelVisualPresetSaveSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const saved = await fastify.prisma.channelVisualPreset.upsert({
        where: { channelId_name: { channelId: channel.id, name: parsed.data.name } },
        create: {
          channelId: channel.id,
          name: parsed.data.name,
          settingsJson: JSON.stringify(parsed.data.settings),
        },
        update: {
          settingsJson: JSON.stringify(parsed.data.settings),
        },
      })
      return reply.send(toDto(saved))
    },
  )

  fastify.delete(
    '/api/me/channel/visual-presets/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const params = parseRouteParams(IdParamSchema, request.params)
      if (!params) return reply.status(400).send({ error: 'Invalid path parameters' })
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const preset = await fastify.prisma.channelVisualPreset.findUnique({
        where: { id: params.id },
        select: { id: true, channelId: true },
      })
      if (!preset || preset.channelId !== channel.id) {
        return reply.status(404).send({ error: 'Preset not found' })
      }
      await fastify.prisma.channelVisualPreset.delete({ where: { id: preset.id } })
      return reply.send({ ok: true })
    },
  )
}

export default meChannelVisualPresetsRoutes
