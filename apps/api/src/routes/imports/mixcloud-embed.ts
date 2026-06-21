// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Readable } from 'node:stream'
import type { FastifyPluginAsync } from 'fastify'
import {
  MIXCLOUD_IMAGE_CDN_HOST,
  MixcloudAddTrackRequestSchema,
  MixcloudAddTrackResponseSchema,
  MixcloudMeTracksResponseSchema,
  MixcloudSearchResponseSchema,
  getMixcloudCloudcastByUrl,
  getMixcloudUserCloudcasts,
  parseMixcloudUsername,
  searchMixcloudCloudcasts,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

// Mixcloud's read API (search, a user's cloudcasts) is public — no client ID, no OAuth.
// That's distinct from the existing @tahti/mixcloud upload client used by mixcloud rescue-import.
const mixcloudEmbedImportRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/imports/mixcloud/search?q=... — "Search Mixcloud" tab.
  fastify.get(
    '/api/v1/imports/mixcloud/search',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description:
          'Mixed-source collections: Mixcloud cloudcast search (embed-only, no audio fetch)',
        response: openApiResponse(MixcloudSearchResponseSchema, 'MixcloudSearchResponse'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>
      const q = query.q?.trim()
      if (!q) return reply.status(400).send({ error: 'q is required' })

      try {
        const tracks = await searchMixcloudCloudcasts(q)
        return reply.send({ tracks })
      } catch {
        return reply.status(502).send({ error: 'Mixcloud search failed' })
      }
    },
  )

  // GET /api/v1/imports/mixcloud/me-tracks — "Your tracks" tab, uses the artist's stored handle.
  fastify.get(
    '/api/v1/imports/mixcloud/me-tracks',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: "Mixed-source collections: the connected artist's own Mixcloud cloudcasts",
        response: openApiResponse(MixcloudMeTracksResponseSchema, 'MixcloudMeTracksResponse'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { mixcloudUsername: true },
      })
      if (!row?.mixcloudUsername) {
        return reply.send({ username: null, tracks: [] })
      }

      try {
        const tracks = await getMixcloudUserCloudcasts(row.mixcloudUsername)
        return reply.send({ username: row.mixcloudUsername, tracks })
      } catch {
        return reply.status(502).send({ error: 'Mixcloud lookup failed' })
      }
    },
  )

  // GET /api/v1/imports/mixcloud/by-username?profileUrl=... — "By artist URL" tab (collaborators).
  fastify.get(
    '/api/v1/imports/mixcloud/by-username',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: 'Mixed-source collections: list a Mixcloud profile by URL or handle',
        response: openApiResponse(MixcloudSearchResponseSchema, 'MixcloudSearchResponse'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>
      const username = query.profileUrl ? parseMixcloudUsername(query.profileUrl) : null
      if (!username) {
        return reply
          .status(400)
          .send({ error: 'Could not parse a Mixcloud handle from profileUrl' })
      }

      try {
        const tracks = await getMixcloudUserCloudcasts(username)
        return reply.send({ tracks })
      } catch {
        return reply.status(502).send({ error: 'Mixcloud lookup failed' })
      }
    },
  )

  // POST /api/v1/imports/mixcloud/add — creates a mixcloud_embed ArchiveItem, appends to the collection.
  fastify.post(
    '/api/v1/imports/mixcloud/add',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: 'Mixed-source collections: add a Mixcloud cloudcast reference to a collection',
        response: openApiResponse(MixcloudAddTrackResponseSchema, 'MixcloudAddTrackResponse'),
      },
    },
    async (request, reply) => {
      const parsed = MixcloudAddTrackRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        })
      }
      const { collectionId, cloudcastUrl } = parsed.data
      const user = request.sessionUser!

      const [channel, collection] = await Promise.all([
        fastify.prisma.channel.findUnique({ where: { userId: user.id }, select: { id: true } }),
        fastify.prisma.collection.findFirst({
          where: { id: collectionId, userId: user.id },
          include: { _count: { select: { items: true } } },
        }),
      ])
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (!collection) return reply.status(404).send({ error: 'Collection not found' })

      let track
      try {
        track = await getMixcloudCloudcastByUrl(cloudcastUrl)
      } catch {
        return reply.status(502).send({ error: 'Could not fetch cloudcast from Mixcloud' })
      }

      const archiveItem = await fastify.prisma.archiveItem.create({
        data: {
          channelId: channel.id,
          title: track.title,
          durationSec: track.durationSec,
          source: 'MIXCLOUD_EMBED',
          qualityBadge: 'EMBED_ONLY',
          embedUri: track.url,
          embedProvider: 'MIXCLOUD',
          status: 'READY',
          isPublic: true,
        },
        select: { id: true },
      })

      const collectionItem = await fastify.prisma.collectionItem.create({
        data: {
          collectionId: collection.id,
          archiveItemId: archiveItem.id,
          position: collection._count.items + 1,
        },
        select: { id: true },
      })

      return reply.status(201).send({
        archiveItemId: archiveItem.id,
        collectionItemId: collectionItem.id,
        track,
      })
    },
  )

  // GET /api/v1/imports/mixcloud/cover?url=... — proxy so the artist's browsing IP never hits
  // Mixcloud's CDN directly from the dashboard search modal.
  // No requireAuth here — <img src> can't carry session cookies. The real safeguard is the
  // thumbnailer.mixcloud.com host allowlist below, not an auth check on a public-image relay.
  fastify.get('/api/v1/imports/mixcloud/cover', async (request, reply) => {
    const query = request.query as Record<string, string>
    const raw = query.url
    if (!raw) return reply.status(400).send({ error: 'url is required' })

    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      return reply.status(400).send({ error: 'Invalid url' })
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== MIXCLOUD_IMAGE_CDN_HOST) {
      return reply.status(400).send({ error: `url must be a ${MIXCLOUD_IMAGE_CDN_HOST} image` })
    }

    const upstream = await fetch(parsed.toString())
    if (!upstream.ok || !upstream.body) {
      return reply.status(502).send({ error: 'Could not fetch cover image' })
    }
    reply.header('Content-Type', upstream.headers.get('content-type') ?? 'image/jpeg')
    reply.header('Cache-Control', 'public, max-age=86400, immutable')
    return reply.send(
      Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream<Uint8Array>),
    )
  })
}

export default mixcloudEmbedImportRoutes
