// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtistEmbedListSchema,
  ArtistEmbedSchema,
  CreateArtistEmbedSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const MAX_EMBEDS = 20

interface SoundCloudOembed {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

async function fetchSoundCloudOembed(url: string): Promise<SoundCloudOembed | null> {
  try {
    const res = await fetch(
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`,
    )
    if (!res.ok) return null
    return (await res.json()) as SoundCloudOembed
  } catch {
    return null
  }
}

function serialize(embed: {
  id: string
  provider: string
  url: string
  title: string | null
  authorName: string | null
  thumbnailUrl: string | null
  createdAt: Date
}) {
  return { ...embed, provider: 'soundcloud' as const, createdAt: embed.createdAt.toISOString() }
}

const meEmbedRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/embeds
  fastify.get(
    '/api/me/embeds',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistEmbedListSchema, 'ArtistEmbedList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const embeds = await fastify.prisma.artistEmbed.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(embeds.map(serialize))
    },
  )

  // POST /api/me/embeds — add a SoundCloud track by URL, resolved via the public oEmbed API
  fastify.post(
    '/api/me/embeds',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponses([
          { status: 201, schema: ArtistEmbedSchema, name: 'ArtistEmbed' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateArtistEmbedSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }

      const existingCount = await fastify.prisma.artistEmbed.count({ where: { userId: user.id } })
      if (existingCount >= MAX_EMBEDS) {
        return reply.status(400).send({ error: `Maximum ${MAX_EMBEDS} embeds` })
      }

      const oembed = await fetchSoundCloudOembed(parsed.data.url)
      if (!oembed) {
        return reply
          .status(400)
          .send({ error: 'Could not resolve that SoundCloud URL — check it is a public track' })
      }

      const embed = await fastify.prisma.artistEmbed.create({
        data: {
          userId: user.id,
          provider: 'soundcloud',
          url: parsed.data.url,
          title: oembed.title ?? null,
          authorName: oembed.author_name ?? null,
          thumbnailUrl: oembed.thumbnail_url ?? null,
        },
      })

      return reply.status(201).send(serialize(embed))
    },
  )

  // DELETE /api/me/embeds/:id
  fastify.delete(
    '/api/me/embeds/:id',
    { preHandler: requireAuth, schema: { tags: ['channel'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const embed = await fastify.prisma.artistEmbed.findFirst({
        where: { id: routeParams.id, userId: user.id },
      })
      if (!embed) return reply.status(404).send({ error: 'Embed not found' })

      await fastify.prisma.artistEmbed.delete({ where: { id: embed.id } })
      return reply.status(204).send()
    },
  )
}

export default meEmbedRoutes
