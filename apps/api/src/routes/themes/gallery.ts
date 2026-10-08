// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// The public "shipped" theme store — reads the tahti-registry catalog
// (themes.json), the same file Tahti Player's Store reads. There is no
// "PUBLIC" state in the Theme table: merging a theme's pull request into
// tahti-registry *is* the publish step, so this always reflects exactly
// what's shipped, with zero app-side bookkeeping to keep in sync.

import type { FastifyPluginAsync } from 'fastify'
import { ThemeGalleryResponseSchema, openApiResponse, type ThemeGalleryEntry } from '@tahti/shared'
import { getCachedJson } from '../../lib/json-cache.js'

const REGISTRY_URL = 'https://raw.githubusercontent.com/janiluuk/tahti-registry/master/themes.json'

function strings(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined
}

/** Maps catalog rows to gallery entries; rows without a name or path are dropped. */
export function galleryEntriesFromCatalog(data: unknown): ThemeGalleryEntry[] {
  const rows = (data as { themes?: unknown } | null)?.themes
  if (!Array.isArray(rows)) return []
  const entries: ThemeGalleryEntry[] = []
  for (const row of rows as Array<Record<string, unknown> | null>) {
    if (!row || typeof row.name !== 'string' || typeof row.path !== 'string') continue
    entries.push({
      ...(typeof row.id === 'string' ? { id: row.id } : {}),
      name: row.name,
      file: row.path,
      ...(typeof row.author === 'string' ? { author: row.author } : {}),
      ...(typeof row.description === 'string' ? { description: row.description } : {}),
      ...(strings(row.tags) ? { tags: strings(row.tags) } : {}),
      ...(strings(row.palette) ? { palette: strings(row.palette) } : {}),
    })
  }
  return entries
}

const themeGalleryRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/themes/gallery',
    {
      schema: {
        tags: ['themes'],
        description: 'Themes published in the tahti-registry catalog',
        response: openApiResponse(ThemeGalleryResponseSchema, 'ThemeGallery'),
      },
    },
    async (_request, reply) => {
      const themes = await getCachedJson('themes:gallery', 300, async () => {
        try {
          const res = await fetch(REGISTRY_URL)
          if (!res.ok) return []
          return galleryEntriesFromCatalog(await res.json())
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
