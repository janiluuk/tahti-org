// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SpotifyLinkProfileRequestSchema,
  SpotifyProfileStatusResponseSchema,
  getSpotifyArtist,
  parseSpotifyArtistId,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { getSpotifyAppToken, spotifyConfigured } from '../../lib/spotify-session.js'

/**
 * Write path for User.spotifyArtistId — the read path (GET /api/v1/imports/spotify/me-tracks)
 * already existed, but nothing ever set this field. Verifies the artist is real via the
 * app-level token before saving, same as every other pasted-URL flow in this codebase.
 */
const spotifyProfileRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/spotify-profile',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: "The connected artist's own Spotify artist profile, if linked",
        response: openApiResponse(SpotifyProfileStatusResponseSchema, 'SpotifyProfileStatus'),
      },
    },
    async (request, reply) => {
      const configured = spotifyConfigured()
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { spotifyArtistId: true },
      })
      if (!row?.spotifyArtistId || !configured) {
        return reply.send({ configured, profile: null })
      }

      try {
        const token = await getSpotifyAppToken()
        const artist = await getSpotifyArtist(token, row.spotifyArtistId)
        return reply.send({
          configured,
          profile: { artistId: artist.id, name: artist.name, imageUrl: artist.imageUrl },
        })
      } catch {
        // Saved ID no longer resolves (e.g. artist removed from Spotify) — report as linked-but-unverifiable.
        return reply.send({
          configured,
          profile: { artistId: row.spotifyArtistId, name: '', imageUrl: null },
        })
      }
    },
  )

  fastify.put(
    '/api/me/spotify-profile',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Link a Spotify artist profile — verified against the Spotify catalog before saving',
        response: openApiResponse(SpotifyProfileStatusResponseSchema, 'SpotifyProfileStatus'),
      },
    },
    async (request, reply) => {
      if (!spotifyConfigured()) {
        return reply.status(503).send({ error: 'Spotify is not configured' })
      }
      const parsed = SpotifyLinkProfileRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        })
      }

      const artistId = parseSpotifyArtistId(parsed.data.artistUrl)
      if (!artistId) {
        return reply.status(400).send({ error: 'Could not parse a Spotify artist from that URL' })
      }

      let artist
      try {
        const token = await getSpotifyAppToken()
        artist = await getSpotifyArtist(token, artistId)
      } catch {
        return reply.status(404).send({ error: 'Could not find that artist on Spotify' })
      }

      const user = request.sessionUser!
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { spotifyArtistId: artist.id },
      })

      return reply.send({
        configured: true,
        profile: { artistId: artist.id, name: artist.name, imageUrl: artist.imageUrl },
      })
    },
  )

  fastify.delete(
    '/api/me/spotify-profile',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Unlink the Spotify artist profile',
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { spotifyArtistId: null },
      })
      return reply.status(204).send()
    },
  )
}

export default spotifyProfileRoute
