// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtworkPresetListSchema,
  ArtworkPresetSchema,
  CreateArtworkPresetSchema,
  IdParamSchema,
  PatchArtworkPresetSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { ARTWORK_PRESET_SELECT, presetDto } from '../../lib/artwork-presets.js'
import { auditLog } from '../../lib/audit.js'
import { invalidateCachedJson } from '../../lib/json-cache.js'
import { requireBoard } from '../../plugins/auth.js'
import { ENABLED_ARTWORK_PRESETS_CACHE_KEY } from '../artwork-presets.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const adminArtworkPresetRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/artwork-presets',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(ArtworkPresetListSchema, 'ArtworkPresetList'),
      },
    },
    async (_request, reply) => {
      const presets = await fastify.prisma.artworkPreset.findMany({
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: ARTWORK_PRESET_SELECT,
      })
      return reply.send({ presets: presets.map(presetDto) })
    },
  )

  fastify.post(
    '/api/admin/artwork-presets',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(ArtworkPresetSchema, 'ArtworkPreset'),
      },
    },
    async (request, reply) => {
      const parsed = CreateArtworkPresetSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const last = await fastify.prisma.artworkPreset.aggregate({ _max: { position: true } })
      const preset = await fastify.prisma.artworkPreset.create({
        data: { ...parsed.data, position: (last._max.position ?? -1) + 1 },
        select: ARTWORK_PRESET_SELECT,
      })
      await invalidateCachedJson(ENABLED_ARTWORK_PRESETS_CACHE_KEY)
      await auditLog(fastify.prisma, {
        action: 'ARTWORK_PRESET_CREATE',
        actorId: request.sessionUser!.id,
        targetId: preset.id,
        meta: { url: preset.url, enabled: preset.enabled },
      })
      return reply.status(201).send(presetDto(preset))
    },
  )

  fastify.patch(
    '/api/admin/artwork-presets/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(ArtworkPresetSchema, 'ArtworkPreset'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchArtworkPresetSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const { count } = await fastify.prisma.artworkPreset.updateMany({
        where: { id: routeParams.id },
        data: parsed.data,
      })
      if (count === 0) return reply.status(404).send({ error: 'Preset not found' })
      const preset = await fastify.prisma.artworkPreset.findUniqueOrThrow({
        where: { id: routeParams.id },
        select: ARTWORK_PRESET_SELECT,
      })
      await invalidateCachedJson(ENABLED_ARTWORK_PRESETS_CACHE_KEY)
      await auditLog(fastify.prisma, {
        action: 'ARTWORK_PRESET_UPDATE',
        actorId: request.sessionUser!.id,
        targetId: preset.id,
        meta: parsed.data,
      })
      return reply.send(presetDto(preset))
    },
  )

  fastify.delete(
    '/api/admin/artwork-presets/:id',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.artworkPreset.deleteMany({
        where: { id: routeParams.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Preset not found' })
      await invalidateCachedJson(ENABLED_ARTWORK_PRESETS_CACHE_KEY)
      await auditLog(fastify.prisma, {
        action: 'ARTWORK_PRESET_DELETE',
        actorId: request.sessionUser!.id,
        targetId: routeParams.id,
      })
      return reply.status(204).send()
    },
  )
}

export default adminArtworkPresetRoutes
