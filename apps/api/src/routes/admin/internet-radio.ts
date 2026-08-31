// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// "Internet radio source configuration" — the admin-curated preset catalog
// users pick from in their own library (routes/me/internet-radio.ts).

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  InternetRadioPresetListSchema,
  InternetRadioPresetSchema,
  UpsertInternetRadioPresetSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

const PRESET_SELECT = {
  id: true,
  name: true,
  genre: true,
  description: true,
  iconUrl: true,
  programmingUrl: true,
  streamUrl: true,
  enabled: true,
} as const

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const adminInternetRadioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/internet-radio-presets',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(InternetRadioPresetListSchema, 'InternetRadioPresetList'),
      },
    },
    async (_request, reply) => {
      const presets = await fastify.prisma.internetRadioPreset.findMany({
        orderBy: { name: 'asc' },
        select: PRESET_SELECT,
      })
      return reply.send({ presets })
    },
  )

  fastify.post(
    '/api/admin/internet-radio-presets',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(InternetRadioPresetSchema, 'InternetRadioPreset'),
      },
    },
    async (request, reply) => {
      const parsed = UpsertInternetRadioPresetSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const preset = await fastify.prisma.internetRadioPreset.create({
        data: parsed.data,
        select: PRESET_SELECT,
      })
      return reply.status(201).send(preset)
    },
  )

  fastify.patch(
    '/api/admin/internet-radio-presets/:id',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = UpsertInternetRadioPresetSchema.partial().safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.internetRadioPreset.findUnique({
        where: { id: routeParams.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Preset not found' })

      const preset = await fastify.prisma.internetRadioPreset.update({
        where: { id: routeParams.id },
        data: parsed.data,
        select: PRESET_SELECT,
      })
      return reply.send(preset)
    },
  )

  fastify.delete(
    '/api/admin/internet-radio-presets/:id',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.internetRadioPreset.deleteMany({
        where: { id: routeParams.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Preset not found' })
      return reply.status(204).send()
    },
  )
}

export default adminInternetRadioRoutes
