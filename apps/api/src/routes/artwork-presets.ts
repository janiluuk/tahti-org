// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ArtworkPresetListSchema, openApiResponse } from '@tahti/shared'
import { ARTWORK_PRESET_SELECT, presetDto } from '../lib/artwork-presets.js'
import { getCachedJson } from '../lib/json-cache.js'

export const ENABLED_ARTWORK_PRESETS_CACHE_KEY = 'artwork-presets:enabled'

const artworkPresetsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/artwork-presets',
    {
      schema: {
        tags: ['artwork'],
        description: 'Board-enabled cover art presets offered in every cover picker',
        response: openApiResponse(ArtworkPresetListSchema, 'ArtworkPresetEnabledList'),
      },
    },
    async (_request, reply) => {
      const result = await getCachedJson(ENABLED_ARTWORK_PRESETS_CACHE_KEY, 60, async () => {
        const presets = await fastify.prisma.artworkPreset.findMany({
          where: { enabled: true },
          orderBy: [{ position: 'asc' }, { id: 'asc' }],
          select: ARTWORK_PRESET_SELECT,
        })
        return { presets: presets.map(presetDto) }
      })
      return reply.send(result)
    },
  )
}

export default artworkPresetsRoute
