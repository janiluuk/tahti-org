// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import { IdParamSchema, ReleaseTrackParamsSchema, parseRouteParams } from '@tahti/shared'
import { z } from 'zod'
import { requireAuth } from '../../plugins/auth.js'

/** Writes positions 1..n in the given order. Positions are unique per release,
 * so every row is parked on a negative slot first. */
export async function writeTrackPositions(
  tx: Prisma.TransactionClient,
  orderedIds: string[],
): Promise<void> {
  for (const [index, id] of orderedIds.entries()) {
    await tx.releaseTrack.update({ where: { id }, data: { position: -(index + 1) } })
  }
  for (const [index, id] of orderedIds.entries()) {
    await tx.releaseTrack.update({ where: { id }, data: { position: index + 1 } })
  }
}

const ReorderReleaseTracksSchema = z.object({
  trackIds: z.array(z.string().min(1)).min(1).max(200),
})

const releaseTrackOrderRoutes: FastifyPluginAsync = async (fastify) => {
  // PUT /api/me/releases/:id/tracks/reorder — set the full track order
  fastify.put(
    '/api/me/releases/:id/tracks/reorder',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: "Set a release's track order; trackIds must list every track once",
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ReorderReleaseTracksSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { trackIds } = parsed.data

      const release = await fastify.prisma.release.findFirst({
        where: { id: routeParams.id, userId: user.id },
        select: { id: true, revelatorId: true, tracks: { select: { id: true } } },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })
      if (release.revelatorId) {
        return reply.status(409).send({
          error:
            'This release has been sent for distribution — its tracklist can no longer change.',
        })
      }

      const current = new Set(release.tracks.map((track) => track.id))
      const requested = new Set(trackIds)
      if (
        requested.size !== trackIds.length ||
        requested.size !== current.size ||
        trackIds.some((id) => !current.has(id))
      ) {
        return reply
          .status(400)
          .send({ error: 'trackIds must list every track on this release exactly once' })
      }

      await fastify.prisma.$transaction((tx) => writeTrackPositions(tx, trackIds))
      return reply.send({ ok: true })
    },
  )

  // DELETE /api/me/releases/:id/tracks/:trackId — remove a track and close the gap
  fastify.delete(
    '/api/me/releases/:id/tracks/:trackId',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'Remove a track from a release and renumber the rest',
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseTrackParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id: releaseId, trackId } = routeParams

      const release = await fastify.prisma.release.findFirst({
        where: { id: releaseId, userId: user.id },
        select: { id: true, revelatorId: true },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })
      if (release.revelatorId) {
        return reply.status(409).send({
          error:
            'This release has been sent for distribution — its tracklist can no longer change.',
        })
      }

      const track = await fastify.prisma.releaseTrack.findFirst({
        where: { id: trackId, releaseId },
        select: { id: true },
      })
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      await fastify.prisma.$transaction(async (tx) => {
        await tx.releaseTrack.delete({ where: { id: trackId } })
        const rest = await tx.releaseTrack.findMany({
          where: { releaseId },
          orderBy: { position: 'asc' },
          select: { id: true },
        })
        await writeTrackPositions(
          tx,
          rest.map((row) => row.id),
        )
      })

      return reply.status(204).send()
    },
  )
}

export default releaseTrackOrderRoutes
