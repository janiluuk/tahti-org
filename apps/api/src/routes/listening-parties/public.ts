// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  ListeningPartyDtoSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { buildListeningPartyDto, listeningPartySelect } from '../../lib/listening-party.js'

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
}

export default publicListeningPartyRoutes
