// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  MotionCertificateSchema,
  MotionVoteTallySchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireMember } from '../../plugins/auth.js'
import { countMotionVotes, motionResultDigest } from '../../lib/motion-certificate.js'

// The result certificate of a closed motion. A closed motion's tally was
// counted from the vote rows on every read, so nothing fixed what the result
// was at the moment of closing and nothing would show if it later changed.

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
      })
    },
  )
}

export default motionCertificateRoutes
