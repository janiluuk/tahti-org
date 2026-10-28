// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  ListeningPartyDtoSchema,
  ListeningPartyTrackParamsSchema,
  openApiRedirectResponse,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { availableUserWhere } from '../../lib/listed-artist.js'
import {
  buildListeningPartyDto,
  isPreRelease,
  listeningPartySelect,
  partyTimeline,
} from '../../lib/listening-party.js'
import { presignedGetUrl } from '../../lib/minio.js'
import { playbackForbiddenBody } from '../../lib/playback-url.js'
import { resolvePlaybackGateStatus } from '../../lib/purchase-tiers.js'

const PUBLIC_STREAM_TTL_SEC = 60 * 60
// A pre-release URL only has to outlive one play of the track (the player
// range-requests as it goes), plus a little slack for buffering and seeks.
const PRE_RELEASE_STREAM_SLACK_SEC = 120

const publicListeningPartyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/listening-parties/:id',
    {
      schema: {
        tags: ['listening-parties'],
        summary: 'A listening party',
        description:
          'Release, tracklist with durations, liner notes, state and the current track + offset. serverNow lets the client correct its clock. Canceled parties are still returned (state CANCELED).',
        response: openApiResponse(ListeningPartyDtoSchema, 'ListeningParty'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const party = await fastify.prisma.listeningParty.findFirst({
        // Down while the host is suspended, like their profile.
        where: { id: routeParams.id, host: availableUserWhere },
        select: listeningPartySelect,
      })
      if (!party) return reply.status(404).send({ error: 'Listening party not found' })
      return reply
        .header('Cache-Control', 'no-store')
        .send(await buildListeningPartyDto(fastify.prisma, party, new Date()))
    },
  )

  fastify.get(
    '/api/v1/listening-parties/:id/tracks/:trackId/stream',
    {
      schema: {
        tags: ['listening-parties'],
        summary: 'Stream a track of a listening party',
        description:
          '302 to a short-lived signed Opus URL. Before release day a track streams only here, only while the party is LIVE, and only for the current or an earlier track (403 otherwise). Once the release is public this behaves like the normal track stream, purchase/subscriber gates included.',
        response: openApiRedirectResponse(302),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(ListeningPartyTrackParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const party = await fastify.prisma.listeningParty.findFirst({
        where: { id: routeParams.id, host: availableUserWhere },
        select: listeningPartySelect,
      })
      if (!party) return reply.status(404).send({ error: 'Listening party not found' })
      const track = await fastify.prisma.releaseTrack.findFirst({
        where: { id: routeParams.trackId, releaseId: party.releaseId },
        select: { position: true, streamKey: true, sourceKey: true, soundId: true },
      })
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      const now = new Date()
      reply.header('Cache-Control', 'no-store')

      if (!isPreRelease(party.release, now)) {
        const key = track.streamKey ?? track.sourceKey
        if (!key) return reply.status(404).send({ error: 'Stream not available' })
        const linked = track.soundId
          ? await fastify.prisma.sound.findUnique({
              where: { id: track.soundId },
              select: {
                accessMode: true,
                purchaseTierId: true,
                channel: { select: { userId: true } },
              },
            })
          : null
        if (linked) {
          const gate = await resolvePlaybackGateStatus(
            fastify.prisma,
            {
              artistUserId: linked.channel.userId,
              accessMode: linked.accessMode,
              purchaseTierId: linked.purchaseTierId,
            },
            request.sessionUser?.id ?? null,
          )
          if (!gate.allowed) return reply.status(403).send(playbackForbiddenBody(gate))
        }
        return reply.redirect(302, await presignedGetUrl(key, PUBLIC_STREAM_TTL_SEC))
      }

      const { state, nowPlaying } = partyTimeline(party, now)
      if (state !== 'LIVE' || !nowPlaying) {
        return reply
          .status(403)
          .send({ error: 'This release streams here only while the party is live' })
      }
      if (track.position > nowPlaying.position) {
        return reply.status(403).send({ error: "This track hasn't played in the party yet" })
      }
      if (!track.streamKey) return reply.status(404).send({ error: 'Stream not available' })
      const durationSec =
        party.release.tracks.find((t) => t.id === routeParams.trackId)?.durationSec ?? 0
      const ttlSec = Math.min(PUBLIC_STREAM_TTL_SEC, durationSec + PRE_RELEASE_STREAM_SLACK_SEC)
      return reply.redirect(302, await presignedGetUrl(track.streamKey, ttlSec))
    },
  )
}

export default publicListeningPartyRoutes
