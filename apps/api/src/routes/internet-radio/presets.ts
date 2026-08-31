// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { InternetRadioPresetListSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { getCachedJson } from '../../lib/json-cache.js'

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

  // Public (no auth) — the Listen page radio feed, board-curated stations
  // shown to every visitor including anonymous ones. Distinct from the
  // authenticated /presets list above, which is the full pick-from catalog
  // for a signed-in listener building their own library.
  fastify.get(
    '/api/v1/internet-radio/presets/enabled',
    {
      schema: {
        tags: ['internet-radio'],
        description: 'Listen page radio feed — board-enabled presets, public',
        response: openApiResponse(InternetRadioPresetListSchema, 'InternetRadioPresetEnabledList'),
      },
    },
    async (_request, reply) => {
      const result = await getCachedJson('internet-radio:presets:enabled', 60, async () => {
        const presets = await fastify.prisma.internetRadioPreset.findMany({
          where: { enabled: true },
          orderBy: { name: 'asc' },
          select: PRESET_SELECT,
        })
        return { presets }
      })
      return reply.send(result)
    },
  )
}

export default internetRadioPresetsRoute
