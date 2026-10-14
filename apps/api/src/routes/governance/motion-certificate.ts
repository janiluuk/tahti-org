// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateMotionResultCorrectionSchema,
  IdParamSchema,
  MotionCertificateSchema,
  MotionVoteTallySchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import {
  countMotionVotes,
  motionCorrectionDigest,
  motionResultDigest,
} from '../../lib/motion-certificate.js'

// The result certificate of a closed motion. A closed motion's tally was
// counted from the vote rows on every read, so nothing fixed what the result
// was at the moment of closing and nothing would show if it later changed.

// A certificate is never rewritten. A result found to be wrong afterwards (a
// vote counted twice, a member who should not have been eligible) is corrected
// by an appended entry whose digest chains to the certificate and to every
// correction before it, so a removed or edited entry shows.

type CorrectionRow = { id: string; note: string; tally: unknown; digest: string; createdAt: Date }

function correctionHistory(certificateDigest: string, rows: CorrectionRow[]) {
  let previous = certificateDigest
  let chainIntact = true
  return rows.map((row) => {
    const parsed = MotionVoteTallySchema.safeParse(row.tally)
    const tally = row.tally === null || !parsed.success ? null : parsed.data
    chainIntact =
      chainIntact &&
      (row.tally === null || parsed.success) &&
      motionCorrectionDigest(previous, { note: row.note, tally, createdAt: row.createdAt }) ===
        row.digest
    previous = row.digest
    return {
      id: row.id,
      note: row.note,
      tally,
      createdAt: row.createdAt,
      digest: row.digest,
      matchesRecord: chainIntact,
    }
  })
}

const motionCertificateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/governance/motions/:id/certificate',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionCertificateSchema, 'MotionCertificate'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const motion = await fastify.prisma.motion.findUnique({ where: { id } })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })
      if (motion.state !== 'CLOSED') {
        return reply
          .status(409)
          .send({ error: 'A certificate exists only once a motion is closed' })
      }
      const stored = MotionVoteTallySchema.safeParse(motion.resultTally)
      if (!motion.closedAt || !motion.resultDigest || !stored.success) {
        // Closed before certificates existed. Issuing one now would certify
        // today's vote rows, not the result as it stood at closing.
        return reply.status(404).send({ error: 'No result certificate was issued for this motion' })
      }
      const tally = stored.data
      const current = await countMotionVotes(fastify.prisma, id)
      const matchesRecord =
        motionResultDigest({ ...motion, closedAt: motion.closedAt }, tally) ===
          motion.resultDigest &&
        current.YES === tally.YES &&
        current.NO === tally.NO &&
        current.ABSTAIN === tally.ABSTAIN

      const corrections = correctionHistory(
        motion.resultDigest,
        await fastify.prisma.motionResultCorrection.findMany({
          where: { motionId: id },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      )
      const correctedTally =
        [...corrections].reverse().find((correction) => correction.tally !== null)?.tally ?? null

      return reply.send({
        motionId: motion.id,
        title: motion.title,
        advisory: motion.advisory,
        closedAt: motion.closedAt,
        eligibleMemberCount: motion.eligibleMemberCount,
        tally,
        totalVotes: tally.YES + tally.NO + tally.ABSTAIN,
        algorithm: 'sha256',
        digest: motion.resultDigest,
        matchesRecord,
        corrections,
        correctedTally,
      })
    },
  )

  fastify.post(
    '/api/admin/governance/motions/:id/result-corrections',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          {
            status: 201,
            schema: MotionCertificateSchema.shape.corrections.element,
            name: 'MotionResultCorrection',
          },
        ]),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = CreateMotionResultCorrectionSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })

      const motion = await fastify.prisma.motion.findUnique({
        where: { id },
        select: { title: true, state: true, resultDigest: true, eligibleMemberCount: true },
      })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })
      if (motion.state !== 'CLOSED' || !motion.resultDigest) {
        return reply
          .status(409)
          .send({ error: 'Only a motion with a result certificate can be corrected' })
      }
      const tally = parsed.data.tally ?? null
      if (
        tally &&
        motion.eligibleMemberCount !== null &&
        tally.YES + tally.NO + tally.ABSTAIN > motion.eligibleMemberCount
      ) {
        return reply
          .status(400)
          .send({ error: 'The corrected tally has more votes than eligible members' })
      }

      const correction = await fastify.prisma.$transaction(async (tx) => {
        // Serialise corrections to one motion so two at once cannot both
        // chain to the same previous entry.
        await tx.$queryRaw`SELECT id FROM "governance"."Motion" WHERE id = ${id} FOR UPDATE`
        const last = await tx.motionResultCorrection.findFirst({
          where: { motionId: id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { digest: true },
        })
        const createdAt = new Date()
        return tx.motionResultCorrection.create({
          data: {
            motionId: id,
            note: parsed.data.note,
            tally: tally ?? undefined,
            createdAt,
            createdById: request.sessionUser!.id,
            digest: motionCorrectionDigest(last?.digest ?? motion.resultDigest!, {
              note: parsed.data.note,
              tally,
              createdAt,
            }),
          },
        })
      })
      await auditLog(fastify.prisma, {
        action: 'MOTION_RESULT_CORRECT',
        actorId: request.sessionUser!.id,
        targetId: id,
        meta: { title: motion.title, correctionId: correction.id, tally },
      })
      return reply.status(201).send({
        id: correction.id,
        note: correction.note,
        tally,
        createdAt: correction.createdAt,
        digest: correction.digest,
        matchesRecord: true,
      })
    },
  )
}

export default motionCertificateRoutes
