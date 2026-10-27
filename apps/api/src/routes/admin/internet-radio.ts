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
import { auditLog } from '../../lib/audit.js'
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

type PresetFields = Record<keyof typeof PRESET_SELECT, unknown>

function changedPresetFields(
  before: PresetFields,
  input: Partial<Record<keyof PresetFields, unknown>>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const [field, value] of Object.entries(input)) {
    const previous = before[field as keyof PresetFields]
    if (value !== undefined && value !== previous) {
      changes[field] = { from: previous, to: value }
    }
  }
  return changes
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
      await auditLog(fastify.prisma, {
        action: 'INTERNET_RADIO_PRESET_CREATE',
        actorId: request.sessionUser!.id,
        targetId: preset.id,
        meta: { name: preset.name, streamUrl: preset.streamUrl, enabled: preset.enabled },
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
        select: PRESET_SELECT,
      })
      if (!existing) return reply.status(404).send({ error: 'Preset not found' })

      const preset = await fastify.prisma.internetRadioPreset.update({
        where: { id: routeParams.id },
        data: parsed.data,
        select: PRESET_SELECT,
      })
      await auditLog(fastify.prisma, {
        action: 'INTERNET_RADIO_PRESET_UPDATE',
        actorId: request.sessionUser!.id,
        targetId: preset.id,
        meta: { name: preset.name, changes: changedPresetFields(existing, parsed.data) },
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

      const existing = await fastify.prisma.internetRadioPreset.findUnique({
        where: { id: routeParams.id },
        select: PRESET_SELECT,
      })
      if (!existing) return reply.status(404).send({ error: 'Preset not found' })

      const { count } = await fastify.prisma.internetRadioPreset.deleteMany({
        where: { id: routeParams.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Preset not found' })
      await auditLog(fastify.prisma, {
        action: 'INTERNET_RADIO_PRESET_DELETE',
        actorId: request.sessionUser!.id,
        targetId: existing.id,
        meta: { name: existing.name, streamUrl: existing.streamUrl },
      })
      return reply.status(204).send()
    },
  )
}

export default adminInternetRadioRoutes
