// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// A listener's own internet radio library — client-side only (see
// packages/shared/src/dto/internet-radio.ts): stations are played directly in
// the browser, never relayed through Tahti's own infrastructure.

import type { FastifyPluginAsync } from 'fastify'
import {
  AddInternetRadioStationSchema,
  IdParamSchema,
  InternetRadioStationListSchema,
  InternetRadioStationSchema,
  PatchInternetRadioStationSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const STATION_SELECT = {
  id: true,
  presetId: true,
  name: true,
  genre: true,
  description: true,
  iconUrl: true,
  programmingUrl: true,
  streamUrl: true,
  position: true,
} as const

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const meInternetRadioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/internet-radio',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['internet-radio'],
        response: openApiResponse(InternetRadioStationListSchema, 'InternetRadioStationList'),
      },
    },
    async (request, reply) => {
      const stations = await fastify.prisma.internetRadioStation.findMany({
        where: { userId: request.sessionUser!.id },
        orderBy: { position: 'asc' },
        select: STATION_SELECT,
      })
      return reply.send({ stations })
    },
  )

  fastify.post(
    '/api/me/internet-radio',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['internet-radio'],
        response: openApiResponse(InternetRadioStationSchema, 'InternetRadioStation'),
      },
    },
    async (request, reply) => {
      const parsed = AddInternetRadioStationSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

      let fields = {
        name: body.name,
        genre: body.genre,
        description: body.description,
        iconUrl: body.iconUrl,
        programmingUrl: body.programmingUrl,
        streamUrl: body.streamUrl,
      }
      if (body.presetId) {
        const preset = await fastify.prisma.internetRadioPreset.findUnique({
          where: { id: body.presetId },
        })
        if (!preset) return reply.status(404).send({ error: 'Preset not found' })
        fields = {
          name: body.name ?? preset.name,
          genre: body.genre ?? preset.genre ?? undefined,
          description: body.description ?? preset.description ?? undefined,
          iconUrl: body.iconUrl ?? preset.iconUrl ?? undefined,
          programmingUrl: body.programmingUrl ?? preset.programmingUrl ?? undefined,
          streamUrl: body.streamUrl ?? preset.streamUrl ?? undefined,
        }
      }
      if (!fields.name) return reply.status(400).send({ error: 'Name is required' })

      const position = await fastify.prisma.internetRadioStation.count({
        where: { userId: request.sessionUser!.id },
      })

      const station = await fastify.prisma.internetRadioStation.create({
        data: {
          userId: request.sessionUser!.id,
          presetId: body.presetId ?? null,
          name: fields.name,
          genre: fields.genre ?? null,
          description: fields.description ?? null,
          iconUrl: fields.iconUrl ?? null,
          programmingUrl: fields.programmingUrl ?? null,
          streamUrl: fields.streamUrl ?? null,
          position,
        },
        select: STATION_SELECT,
      })
      return reply.status(201).send(station)
    },
  )

  fastify.patch(
    '/api/me/internet-radio/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchInternetRadioStationSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.internetRadioStation.findFirst({
        where: { id: routeParams.id, userId: request.sessionUser!.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Station not found' })

      const station = await fastify.prisma.internetRadioStation.update({
        where: { id: routeParams.id },
        data: parsed.data,
        select: STATION_SELECT,
      })
      return reply.send(station)
    },
  )

  fastify.delete(
    '/api/me/internet-radio/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.internetRadioStation.deleteMany({
        where: { id: routeParams.id, userId: request.sessionUser!.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Station not found' })
      return reply.status(204).send()
    },
  )
}

export default meInternetRadioRoutes
