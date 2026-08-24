// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// The public "shipped" theme store — reads live from the tahti-org repo
// itself (themes/registry.json), the same technique the original theme
// editor tool uses for Nuclear's own theme registry. There is no "PUBLIC"
// state in the Theme table: merging a theme's PR *is* the publish step, so
// this always reflects exactly what's actually shipped, with zero app-side
// bookkeeping to keep in sync.

import type { FastifyPluginAsync } from 'fastify'
import { ThemeGalleryResponseSchema, openApiResponse } from '@tahti/shared'
import { getCachedJson } from '../../lib/json-cache.js'

const REGISTRY_URL =
  'https://raw.githubusercontent.com/janiluuk/tahti-org/main/themes/registry.json'

const themeGalleryRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/themes/gallery',
    {
      schema: {
        tags: ['themes'],
        response: openApiResponse(ThemeGalleryResponseSchema, 'ThemeGallery'),
      },
    },
    async (_request, reply) => {
      const themes = await getCachedJson('themes:gallery', 300, async () => {
        try {
          const res = await fetch(REGISTRY_URL)
          // No registry file yet (nothing has shipped) is expected, not an error.
          if (!res.ok) return []
          const data = await res.json()
          return Array.isArray(data) ? data : []
        } catch (e) {
          fastify.log.warn(e, 'failed to fetch theme registry')
          return []
        }
      })
      return reply.send({ themes })
    },
  )
}

export default themeGalleryRoute
