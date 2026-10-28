// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import type { Prisma, PrismaClient } from '@tahti/db'
import {
  CreateListeningPartyBodySchema,
  IdParamSchema,
  LISTENING_PARTY_MAX_LEAD_MS,
  LISTENING_PARTY_MIN_LEAD_MS,
  ListeningPartyDtoSchema,
  ListeningPartySummaryListSchema,
  listeningPartyDurationSec,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
  UpdateListeningPartyBodySchema,
} from '@tahti/shared'
import type { ZodError } from 'zod'
import { requireAuth } from '../../plugins/auth.js'
import {
  buildListeningPartyDto,
  buildListeningPartySummary,
  findOverlappingParty,
  listeningPartySelect,
  partyTimeline,
  type ListeningPartyRow,
} from '../../lib/listening-party.js'

function badRequest(reply: FastifyReply, error: ZodError) {
  return reply.status(400).send({ error: error.issues[0]?.message ?? 'Invalid body' })
}

/** Null when startAt is inside the allowed scheduling window. */
function startAtError(startAt: Date, now: Date): string | null {
  if (Number.isNaN(startAt.getTime())) return 'Invalid startAt'
  if (startAt.getTime() < now.getTime() + LISTENING_PARTY_MIN_LEAD_MS) {
    return 'startAt must be at least 5 minutes from now'
  }
  if (startAt.getTime() > now.getTime() + LISTENING_PARTY_MAX_LEAD_MS) {
    return 'startAt must be within 365 days'
  }
  return null
}

/** Serialises party writes per channel so two overlapping parties can't both
 * pass the overlap check at once. */
async function lockChannelParties(tx: Prisma.TransactionClient, channelId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`listening-party:${channelId}`}))`
}

class OverlapError extends Error {}

/** The party when the signed-in user hosts it; otherwise the reply is sent. */
async function loadHostedParty(
  prisma: PrismaClient,
  reply: FastifyReply,
  params: unknown,
  userId: string,
): Promise<ListeningPartyRow | null> {
  const routeParams = parseRouteParams(IdParamSchema, params)
  if (!routeParams) {
    await reply.status(400).send({ error: 'Invalid path parameters' })
    return null
  }
  const party = await prisma.listeningParty.findUnique({
    where: { id: routeParams.id },
    select: listeningPartySelect,
  })
  if (!party) {
    await reply.status(404).send({ error: 'Listening party not found' })
    return null
  }
  if (party.hostUserId !== userId) {
    await reply.status(403).send({ error: 'Not your listening party' })
    return null
  }
  return party
}

const meListeningPartyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/me/listening-parties',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['listening-parties'],
        summary: 'Schedule a listening party for one of your releases',
        description:
          'Answers 201. 400 when startAt is under 5 minutes or over 365 days ahead, or the release has no tracks or a track without a duration or stream; 403 when the release is not yours or you have no channel; 409 when another party on your channel overlaps.',
        response: openApiResponses([
          { status: 201, schema: ListeningPartyDtoSchema, name: 'ListeningParty' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateListeningPartyBodySchema.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error)
      const body = parsed.data
      const now = new Date()
      const startAt = new Date(body.startAt)
      const startError = startAtError(startAt, now)
      if (startError) return reply.status(400).send({ error: startError })

      const release = await fastify.prisma.release.findUnique({
        where: { id: body.releaseId },
        select: {
          userId: true,
          tracks: { select: { durationSec: true, streamKey: true } },
        },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })
      if (release.userId !== user.id) {
        return reply.status(403).send({ error: 'Not your release' })
      }
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) {
        return reply.status(403).send({ error: 'You need a channel to host a listening party' })
      }
      if (release.tracks.length === 0) {
        return reply.status(400).send({ error: 'The release has no tracks' })
      }
      if (release.tracks.some((t) => !t.durationSec || t.durationSec <= 0)) {
        return reply.status(400).send({ error: 'Every track needs a duration' })
      }
      if (release.tracks.some((t) => !t.streamKey)) {
        return reply.status(400).send({ error: 'Every track needs a stream; wait for transcoding' })
      }

      const endAt = new Date(startAt.getTime() + listeningPartyDurationSec(release.tracks) * 1000)
      let partyId: string
      try {
        partyId = await fastify.prisma.$transaction(async (tx) => {
          await lockChannelParties(tx, channel.id)
          const clash = await findOverlappingParty(tx, { channelId: channel.id, startAt, endAt })
          if (clash) throw new OverlapError()
          const created = await tx.listeningParty.create({
            data: {
              releaseId: body.releaseId,
              channelId: channel.id,
              hostUserId: user.id,
              startAt,
              hostNote: body.hostNote,
            },
            select: { id: true },
          })
          return created.id
        })
      } catch (err) {
        if (err instanceof OverlapError) {
          return reply
            .status(409)
            .send({ error: 'Another listening party on your channel overlaps this time' })
        }
        throw err
      }

      const party = await fastify.prisma.listeningParty.findUniqueOrThrow({
        where: { id: partyId },
        select: listeningPartySelect,
      })
      return reply.status(201).send(await buildListeningPartyDto(fastify.prisma, party, now))
    },
  )

  fastify.get(
    '/api/me/listening-parties',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['listening-parties'],
        summary: 'Your listening parties',
        description: 'Every party you host, in any state, latest startAt first.',
        response: openApiResponse(ListeningPartySummaryListSchema, 'ListeningPartySummaryList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const now = new Date()
      const parties = await fastify.prisma.listeningParty.findMany({
        where: { hostUserId: user.id },
        orderBy: { startAt: 'desc' },
        select: listeningPartySelect,
      })
      const items = await Promise.all(parties.map((p) => buildListeningPartySummary(p, now)))
      return reply.send({ items })
    },
  )

  fastify.patch(
    '/api/me/listening-parties/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['listening-parties'],
        summary: 'Reschedule a listening party or edit its host note',
        description:
          'Only while SCHEDULED: 409 once LIVE, ENDED or CANCELED, and 409 when the new time overlaps another party on your channel. startAt follows the same 5 minute / 365 day window as create.',
        response: openApiResponse(ListeningPartyDtoSchema, 'ListeningParty'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const party = await loadHostedParty(fastify.prisma, reply, request.params, user.id)
      if (!party) return reply
      const parsed = UpdateListeningPartyBodySchema.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error)
      const body = parsed.data
      const now = new Date()

      const { state } = partyTimeline(party, now)
      if (state !== 'SCHEDULED') {
        return reply
          .status(409)
          .send({ error: `A ${state.toLowerCase()} listening party can't be changed` })
      }

      const startAt = body.startAt ? new Date(body.startAt) : undefined
      if (startAt) {
        const startError = startAtError(startAt, now)
        if (startError) return reply.status(400).send({ error: startError })
      }

      try {
        await fastify.prisma.$transaction(async (tx) => {
          if (startAt) {
            await lockChannelParties(tx, party.channelId)
            const endAt = new Date(
              startAt.getTime() + listeningPartyDurationSec(party.release.tracks) * 1000,
            )
            const clash = await findOverlappingParty(tx, {
              channelId: party.channelId,
              startAt,
              endAt,
              excludeId: party.id,
            })
            if (clash) throw new OverlapError()
          }
          await tx.listeningParty.update({
            where: { id: party.id },
            data: {
              ...(startAt ? { startAt } : {}),
              ...(body.hostNote !== undefined ? { hostNote: body.hostNote } : {}),
            },
          })
        })
      } catch (err) {
        if (err instanceof OverlapError) {
          return reply
            .status(409)
            .send({ error: 'Another listening party on your channel overlaps this time' })
        }
        throw err
      }

      const updated = await fastify.prisma.listeningParty.findUniqueOrThrow({
        where: { id: party.id },
        select: listeningPartySelect,
      })
      return reply.send(await buildListeningPartyDto(fastify.prisma, updated, now))
    },
  )
}

export default meListeningPartyRoutes
