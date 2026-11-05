// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import {
  IdParamSchema,
  ListeningPartyReminderSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { isBlockedEitherWay } from '../../lib/user-blocks.js'
import { listeningPartySelect, partyTimeline } from '../../lib/listening-party.js'

const reminderSchema = {
  tags: ['listening-parties'],
  response: openApiResponse(ListeningPartyReminderSchema, 'ListeningPartyReminder'),
}

const listeningPartyReminderRoutes: FastifyPluginAsync = async (fastify) => {
  async function loadParty(params: unknown, reply: FastifyReply, viewerId: string | null) {
    const routeParams = parseRouteParams(IdParamSchema, params)
    if (!routeParams) {
      reply.status(400).send({ error: 'Invalid path parameters' })
      return null
    }
    const party = await fastify.prisma.listeningParty.findFirst({
      where: { id: routeParams.id, host: availableUserWhere },
      select: listeningPartySelect,
    })
    if (
      !party ||
      (viewerId && (await isBlockedEitherWay(fastify.prisma, party.hostUserId, viewerId)))
    ) {
      reply.status(404).send({ error: 'Listening party not found' })
      return null
    }
    return party
  }

  async function reminderState(partyId: string, viewerId: string | null) {
    const [count, mine] = await Promise.all([
      fastify.prisma.listeningPartyReminder.count({ where: { partyId } }),
      viewerId
        ? fastify.prisma.listeningPartyReminder.findUnique({
            where: { partyId_userId: { partyId, userId: viewerId } },
            select: { partyId: true },
          })
        : null,
    ])
    return { reminded: Boolean(mine), count }
  }

  fastify.get(
    '/api/v1/listening-parties/:id/reminder',
    {
      schema: {
        ...reminderSchema,
        summary: 'Reminders for a listening party',
        description: 'How many people asked to be reminded, and whether you did.',
      },
    },
    async (request, reply) => {
      const viewerId = request.sessionUser?.id ?? null
      const party = await loadParty(request.params, reply, viewerId)
      if (!party) return reply
      return reply.send(await reminderState(party.id, viewerId))
    },
  )

  fastify.post(
    '/api/v1/listening-parties/:id/reminder',
    {
      preHandler: requireAuth,
      schema: {
        ...reminderSchema,
        summary: 'Remind me when this listening party starts',
        description:
          'Only while SCHEDULED (409 once LIVE, ENDED or CANCELED). Asking twice is a no-op. You are also told if the party moves or is cancelled.',
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const party = await loadParty(request.params, reply, user.id)
      if (!party) return reply
      const { state } = partyTimeline(party, new Date())
      if (state !== 'SCHEDULED') {
        return reply
          .status(409)
          .send({ error: `A ${state.toLowerCase()} listening party takes no reminders` })
      }
      await fastify.prisma.listeningPartyReminder.upsert({
        where: { partyId_userId: { partyId: party.id, userId: user.id } },
        create: { partyId: party.id, userId: user.id },
        update: {},
      })
      return reply.send(await reminderState(party.id, user.id))
    },
  )

  fastify.delete(
    '/api/v1/listening-parties/:id/reminder',
    {
      preHandler: requireAuth,
      schema: { ...reminderSchema, summary: 'Stop reminding me about this listening party' },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const party = await loadParty(request.params, reply, user.id)
      if (!party) return reply
      await fastify.prisma.listeningPartyReminder.deleteMany({
        where: { partyId: party.id, userId: user.id },
      })
      return reply.send(await reminderState(party.id, user.id))
    },
  )
}

export default listeningPartyReminderRoutes
