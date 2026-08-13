// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  HearthisAddTrackRequestSchema,
  HearthisAddTrackResponseSchema,
  HearthisSearchResponseSchema,
  HearthisUserTracksResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { createHearthisClient, parseHearthisUsername, type HearthisTrack } from '@tahti/hearthis'
import { requireAuth } from '../../plugins/auth.js'

// hearthis.at's read API (search, feed, profiles, tracks) is public — no key/secret required.
// Mirrors imports/mixcloud-embed.ts: embed-only, we never fetch or re-host hearthis.at audio.
const hearthis = createHearthisClient()

function toTrackResult(track: HearthisTrack) {
  return {
    url: track.permalink_url,
    title: track.title,
    username: track.user.username,
    userPermalink: track.user.permalink,
    durationSec: Number.parseInt(track.duration, 10) || 0,
    coverUrl: track.artwork_url ?? null,
    genre: track.genre ?? null,
    streamUrl: track.stream_url ?? null,
  }
}

const hearthisImportRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/imports/hearthis/search?q=... — "Search hearthis.at" tab.
  fastify.get(
    '/api/v1/imports/hearthis/search',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: 'Mixed-source collections: hearthis.at track search (embed-only, no audio fetch)',
        response: openApiResponse(HearthisSearchResponseSchema, 'HearthisSearchResponse'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>
      const q = query.q?.trim()
      if (!q) return reply.status(400).send({ error: 'q is required' })

      try {
        const tracks = await hearthis.search(q, { count: 20 })
        return reply.send({ tracks: tracks.map(toTrackResult) })
      } catch {
        return reply.status(502).send({ error: 'hearthis.at search failed' })
      }
    },
  )

  // GET /api/v1/imports/hearthis/me-tracks — "Your tracks" tab, uses the artist's stored handle.
  fastify.get(
    '/api/v1/imports/hearthis/me-tracks',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: "Mixed-source collections: the connected artist's own hearthis.at tracks",
        response: openApiResponse(HearthisUserTracksResponseSchema, 'HearthisUserTracksResponse'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { hearthisUsername: true },
      })
      if (!row?.hearthisUsername) {
        return reply.send({ username: null, tracks: [] })
      }

      try {
        const tracks = await hearthis.getUserTracks(row.hearthisUsername)
        return reply.send({ username: row.hearthisUsername, tracks: tracks.map(toTrackResult) })
      } catch {
        return reply.status(502).send({ error: 'hearthis.at lookup failed' })
      }
    },
  )

  // GET /api/v1/imports/hearthis/by-username?profileUrl=... — "By artist URL" tab (collaborators).
  fastify.get(
    '/api/v1/imports/hearthis/by-username',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: 'Mixed-source collections: list a hearthis.at profile by URL or handle',
        response: openApiResponse(HearthisUserTracksResponseSchema, 'HearthisUserTracksResponse'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>
      const username = query.profileUrl ? parseHearthisUsername(query.profileUrl) : null
      if (!username) {
        return reply.status(400).send({ error: 'Could not parse a hearthis.at handle from profileUrl' })
      }

      try {
        const tracks = await hearthis.getUserTracks(username)
        return reply.send({ username, tracks: tracks.map(toTrackResult) })
      } catch {
        return reply.status(502).send({ error: 'hearthis.at lookup failed' })
      }
    },
  )

  // POST /api/v1/imports/hearthis/add — creates a hearthis_embed ArchiveItem, appends to the collection.
  fastify.post(
    '/api/v1/imports/hearthis/add',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: 'Mixed-source collections: add a hearthis.at track reference to a collection',
        response: openApiResponse(HearthisAddTrackResponseSchema, 'HearthisAddTrackResponse'),
      },
    },
    async (request, reply) => {
      const parsed = HearthisAddTrackRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        })
      }
      const { collectionId, trackUrl } = parsed.data
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
        track = await hearthis.getTrackByUrl(trackUrl)
      } catch {
        return reply.status(502).send({ error: 'Could not fetch track from hearthis.at' })
      }
      const result = toTrackResult(track)

      const archiveItem = await fastify.prisma.archiveItem.create({
        data: {
          channelId: channel.id,
          title: result.title,
          durationSec: result.durationSec,
          source: 'HEARTHIS_EMBED',
          qualityBadge: 'EMBED_ONLY',
          embedUri: result.url,
          embedProvider: 'HEARTHIS',
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
        track: result,
      })
    },
  )
}

export default hearthisImportRoutes
