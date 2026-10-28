// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  CreateListeningPartyBodySchema,
  LISTENING_PARTY_MAX_LEAD_MS,
  LISTENING_PARTY_MIN_LEAD_MS,
  ListeningPartyDtoSchema,
  ListeningPartySummaryListSchema,
  listeningPartyDurationSec,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import type { ZodError } from 'zod'
import { requireAuth } from '../../plugins/auth.js'
import {
  buildListeningPartyDto,
  buildListeningPartySummary,
  findOverlappingParty,
  listeningPartySelect,
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
}

export default meListeningPartyRoutes
