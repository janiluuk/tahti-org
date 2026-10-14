// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  HearthisAddTrackRequestSchema,
  HearthisAddTrackResponseSchema,
  HearthisSearchResponseSchema,
  HearthisSetTracksResponseSchema,
  HearthisUserSetsResponseSchema,
  HearthisUserTracksResponseSchema,
  mapGenre,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import {
  createHearthisClient,
  parseHearthisSetPermalink,
  parseHearthisUsername,
  type HearthisPlaylist,
  type HearthisTrack,
} from '@tahti/hearthis'
import { getUserIntegrationCredential, soundOwnerDefaults } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { enqueueHearthisEmbedLocalization } from '../../lib/queue.js'
import { nextCollectionPosition } from '../collections/helpers.js'

// hearthis.at's read API (search, feed, profiles, tracks) is public — no key/secret required.
// Mirrors imports/mixcloud-embed.ts: embed-only, we never fetch or re-host hearthis.at audio.
const hearthis = createHearthisClient()

function yearFromHearthisDate(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^(\d{4})/.exec(value.trim())
  if (!match) return null
  const year = Number.parseInt(match[1], 10)
  return year >= 1900 && year <= 2100 ? year : null
}

function toTrackResult(track: HearthisTrack) {
  return {
    id: track.id,
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

function toSetResult(set: HearthisPlaylist) {
  const permalink = set.permalink
  return {
    id: set.id,
    permalink,
    url: `https://hearthis.at/set/${encodeURIComponent(permalink)}/`,
    title: set.title,
    description: set.description ?? '',
    trackCount: set.track_count ?? 0,
    coverUrl: set.artwork_url ?? null,
    username: set.user.username,
    userPermalink: set.user.permalink,
    year: yearFromHearthisDate(set.release_date ?? set.created_at),
  }
}

function toSetTrackResult(track: HearthisTrack, position: number) {
  const downloadable = track.downloadable === '1' && Boolean(track.download_url)
  return {
    ...toTrackResult(track),
    position,
    kind: track.type?.trim() || null,
    releaseDate: track.release_date?.trim() || null,
    downloadable,
    downloadUrl: downloadable ? (track.download_url ?? null) : null,
    downloadFilename: downloadable ? (track.download_filename ?? null) : null,
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
        summary: 'Search hearthis.at tracks',
        description:
          'Mixed-source collections: hearthis.at track search (embed-only, no audio fetch)',
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
        summary: "List the caller's hearthis.at tracks",
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
        summary: 'List hearthis.at tracks by profile URL',
        description: 'Mixed-source collections: list a hearthis.at profile by URL or handle',
        response: openApiResponse(HearthisUserTracksResponseSchema, 'HearthisUserTracksResponse'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>
      const username = query.profileUrl ? parseHearthisUsername(query.profileUrl) : null
      if (!username) {
        return reply
          .status(400)
          .send({ error: 'Could not parse a hearthis.at handle from profileUrl' })
      }

      try {
        const tracks = await hearthis.getUserTracks(username)
        return reply.send({ username, tracks: tracks.map(toTrackResult) })
      } catch {
        return reply.status(502).send({ error: 'hearthis.at lookup failed' })
      }
    },
  )

  // GET /api/v1/imports/hearthis/me-sets — artist's hearthis.at Sets (playlists).
  // On hearthis.at a "Set" is usually an album-like grouping but can also be a playlist.
  fastify.get(
    '/api/v1/imports/hearthis/me-sets',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: "List the caller's hearthis.at Sets",
        description:
          "List the connected artist's hearthis.at Sets (playlists). Requires hearthisUsername on the profile.",
        response: openApiResponse(HearthisUserSetsResponseSchema, 'HearthisUserSetsResponse'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const row = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { hearthisUsername: true },
      })
      if (!row?.hearthisUsername) {
        return reply.send({ username: null, sets: [] })
      }

      try {
        const sets = await hearthis.getUserPlaylists(row.hearthisUsername)
        return reply.send({ username: row.hearthisUsername, sets: sets.map(toSetResult) })
      } catch {
        return reply.status(502).send({ error: 'hearthis.at set listing failed' })
      }
    },
  )

  // GET /api/v1/imports/hearthis/sets/:permalink/tracks — tracks inside one Set.
  fastify.get(
    '/api/v1/imports/hearthis/sets/:permalink/tracks',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'List tracks in a hearthis.at Set',
        description:
          'List tracks in a hearthis.at Set (playlist). Permalink from GET …/me-sets or a set URL.',
        response: openApiResponse(HearthisSetTracksResponseSchema, 'HearthisSetTracksResponse'),
      },
    },
    async (request, reply) => {
      const raw = (request.params as { permalink?: string }).permalink ?? ''
      const permalink = parseHearthisSetPermalink(decodeURIComponent(raw))
      if (!permalink) {
        return reply.status(400).send({ error: 'Invalid set permalink' })
      }

      try {
        const tracks = await hearthis.getSetTracks(permalink)
        const mapped = tracks.map((track, index) => toSetTrackResult(track, index + 1))
        // Resolve album-like Set title/artist/year from the owner's playlist catalog.
        let setMeta: ReturnType<typeof toSetResult> | null = null
        const ownerPermalink = tracks[0]?.user.permalink
        if (ownerPermalink) {
          try {
            const playlists = await hearthis.getUserPlaylists(ownerPermalink)
            const match = playlists.find((playlist) => playlist.permalink === permalink)
            if (match) setMeta = toSetResult(match)
          } catch {
            // Set tracks still return without metadata.
          }
        }
        return reply.send({
          permalink,
          url: `https://hearthis.at/set/${encodeURIComponent(permalink)}/`,
          set: setMeta,
          tracks: mapped,
        })
      } catch {
        return reply.status(502).send({ error: 'hearthis.at set tracks lookup failed' })
      }
    },
  )

  // POST /api/v1/imports/hearthis/add — creates a hearthis_embed Sound, appends to the collection.
  fastify.post(
    '/api/v1/imports/hearthis/add',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'Add a hearthis.at track to a collection',
        description:
          'Creates a hearthis_embed Sound and appends it to the collection. Answers 201. Embed-only unless the uploader marked the track downloadable.',
        response: openApiResponses([
          { status: 201, schema: HearthisAddTrackResponseSchema, name: 'HearthisAddTrackResponse' },
        ]),
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

      const credential = await getUserIntegrationCredential(
        fastify.prisma,
        user.id,
        'hearthis-import',
      )
      if (!credential) {
        return reply.status(400).send({ error: 'Install the hearthis.at import plugin first' })
      }

      const [channel, collection] = await Promise.all([
        fastify.prisma.channel.findUnique({ where: { userId: user.id }, select: { id: true } }),
        fastify.prisma.collection.findFirst({
          where: { id: collectionId, userId: user.id },
          select: { id: true },
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

      const sound = await fastify.prisma.sound.create({
        data: {
          channelId: channel.id,
          title: result.title,
          durationSec: result.durationSec,
          source: 'HEARTHIS_EMBED',
          qualityBadge: 'EMBED_ONLY',
          contentType: 'EMBED',
          embedUri: result.id,
          embedProvider: 'HEARTHIS',
          embedSourceUrl: track.permalink_url,
          status: 'READY',
          isPublic: true,
          bannerUrl: result.coverUrl,
          ...(result.genre ? mapGenre(result.genre) : {}),
          ...(await soundOwnerDefaults(fastify.prisma, channel.id)),
        },
        select: { id: true },
      })

      const collectionItem = await fastify.prisma.collectionItem.create({
        data: {
          collectionId: collection.id,
          soundId: sound.id,
          position: await nextCollectionPosition(fastify.prisma, collection.id),
        },
        select: { id: true },
      })

      // A public download flag is explicit permission from the uploader to
      // download this file. Localize those tracks in the background so Tahti
      // can use its native player and preserve lossless originals when offered.
      if (track.downloadable === '1' && track.download_url) {
        await enqueueHearthisEmbedLocalization({ soundId: sound.id, trackUrl })
      }

      return reply.status(201).send({
        soundId: sound.id,
        collectionItemId: collectionItem.id,
        track: result,
      })
    },
  )
}

export default hearthisImportRoutes
