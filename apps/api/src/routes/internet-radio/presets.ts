// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { InternetRadioPresetListSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const PRESET_SELECT = {
  id: true,
  name: true,
  genre: true,
  description: true,
  iconUrl: true,
  programmingUrl: true,
  streamUrl: true,
} as const

const internetRadioPresetsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/internet-radio/presets',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['internet-radio'],
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
}

export default internetRadioPresetsRoute
