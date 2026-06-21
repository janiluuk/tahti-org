// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Readable } from 'node:stream'
import type { FastifyPluginAsync } from 'fastify'
import {
  SpotifyAddTrackRequestSchema,
  SpotifyAddTrackResponseSchema,
  SpotifyMeTracksResponseSchema,
  SpotifySearchResponseSchema,
  getSpotifyArtistTracks,
  getSpotifyTrack,
  parseSpotifyArtistId,
  searchSpotifyTracks,
  trackIdFromSpotifyUri,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { getSpotifyAppToken, spotifyConfigured } from '../../lib/spotify-session.js'

const spotifyImportRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/imports/spotify/search?q=... — "Search Spotify" tab, app-token only.
  fastify.get(
    '/api/v1/imports/spotify/search',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: 'Mixed-source collections: Spotify track search (embed-only, no audio fetch)',
        response: openApiResponse(SpotifySearchResponseSchema, 'SpotifySearchResponse'),
      },
    },
    async (request, reply) => {
      if (!spotifyConfigured()) {
        return reply.status(503).send({ error: 'Spotify search is not configured' })
      }
      const query = request.query as Record<string, string>
      const q = query.q?.trim()
      if (!q) return reply.status(400).send({ error: 'q is required' })

      try {
        const token = await getSpotifyAppToken()
        const tracks = await searchSpotifyTracks(token, q)
        return reply.send({ tracks })
      } catch {
        return reply.status(502).send({ error: 'Spotify search failed' })
      }
    },
  )

  // GET /api/v1/imports/spotify/me-tracks — "Your tracks" tab, uses the artist's stored Spotify ID.
  fastify.get(
    '/api/v1/imports/spotify/me-tracks',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: "Mixed-source collections: the connected artist's own Spotify catalogue",
        response: openApiResponse(SpotifyMeTracksResponseSchema, 'SpotifyMeTracksResponse'),
      },
    },
    async (request, reply) => {
      if (!spotifyConfigured()) {
        return reply.status(503).send({ error: 'Spotify search is not configured' })
      }
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { spotifyArtistId: true },
      })
      if (!row?.spotifyArtistId) {
        return reply.send({ artistId: null, tracks: [] })
      }

      try {
        const token = await getSpotifyAppToken()
        const tracks = await getSpotifyArtistTracks(token, row.spotifyArtistId)
        return reply.send({ artistId: row.spotifyArtistId, tracks })
      } catch {
        return reply.status(502).send({ error: 'Spotify lookup failed' })
      }
    },
  )

  // GET /api/v1/imports/spotify/by-artist-url?artistUrl=... — "By artist URL" tab (collaborators).
  fastify.get(
    '/api/v1/imports/spotify/by-artist-url',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: 'Mixed-source collections: list a Spotify artist catalogue by profile URL',
        response: openApiResponse(SpotifySearchResponseSchema, 'SpotifySearchResponse'),
      },
    },
    async (request, reply) => {
      if (!spotifyConfigured()) {
        return reply.status(503).send({ error: 'Spotify search is not configured' })
      }
      const query = request.query as Record<string, string>
      const artistId = query.artistUrl ? parseSpotifyArtistId(query.artistUrl) : null
      if (!artistId) {
        return reply.status(400).send({ error: 'Could not parse a Spotify artist from artistUrl' })
      }

      try {
        const token = await getSpotifyAppToken()
        const tracks = await getSpotifyArtistTracks(token, artistId)
        return reply.send({ tracks })
      } catch {
        return reply.status(502).send({ error: 'Spotify lookup failed' })
      }
    },
  )

  // POST /api/v1/imports/spotify/add — creates a spotify_embed ArchiveItem, appends to the collection.
  fastify.post(
    '/api/v1/imports/spotify/add',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: 'Mixed-source collections: add a Spotify track reference to a collection',
        response: openApiResponse(SpotifyAddTrackResponseSchema, 'SpotifyAddTrackResponse'),
      },
    },
    async (request, reply) => {
      if (!spotifyConfigured()) {
        return reply.status(503).send({ error: 'Spotify search is not configured' })
      }
      const parsed = SpotifyAddTrackRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        })
      }
      const { collectionId, spotifyUri } = parsed.data
      const user = request.sessionUser!

      const trackId = trackIdFromSpotifyUri(spotifyUri)
      if (!trackId) return reply.status(400).send({ error: 'Invalid spotifyUri' })

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
        const token = await getSpotifyAppToken()
        track = await getSpotifyTrack(token, trackId)
      } catch {
        return reply.status(502).send({ error: 'Could not fetch track from Spotify' })
      }

      const archiveItem = await fastify.prisma.archiveItem.create({
        data: {
          channelId: channel.id,
          title: track.title,
          durationSec: track.durationSec,
          source: 'SPOTIFY_EMBED',
          qualityBadge: 'EMBED_ONLY',
          embedUri: track.uri,
          embedProvider: 'SPOTIFY',
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

  // GET /api/v1/imports/spotify/cover?url=... — proxy so the artist's browsing IP never hits
  // Spotify's CDN directly from the dashboard search modal.
  // No requireAuth here — <img src> can't carry session cookies. The real safeguard is the
  // i.scdn.co host allowlist below, not an auth check on a public-image relay.
  fastify.get('/api/v1/imports/spotify/cover', async (request, reply) => {
    const query = request.query as Record<string, string>
    const raw = query.url
    if (!raw) return reply.status(400).send({ error: 'url is required' })

    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      return reply.status(400).send({ error: 'Invalid url' })
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'i.scdn.co') {
      return reply.status(400).send({ error: 'url must be an i.scdn.co cover image' })
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

export default spotifyImportRoutes
