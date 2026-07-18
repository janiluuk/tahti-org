// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateFeatureRequestSchema,
  FeatureRequestCommentListSchema,
  FeatureRequestCommentSchema,
  FeatureRequestListSchema,
  FeatureRequestSummarySchema,
  IdParamSchema,
  PostFeatureRequestCommentSchema,
  VoteFeatureRequestResponseSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

const featureRequestsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/governance/feature-requests — everyone's requests, most-voted first
  fastify.get(
    '/api/v1/governance/feature-requests',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(FeatureRequestListSchema, 'FeatureRequestList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const rows = await fastify.prisma.featureRequest.findMany({
        orderBy: [{ votes: { _count: 'desc' } }, { createdAt: 'desc' }],
        take: 200,
        include: {
          proposedBy: { select: { displayName: true } },
          mergedInto: { select: { title: true } },
          _count: { select: { votes: true, comments: true } },
          votes: { where: { userId: user.id }, select: { userId: true } },
        },
      })

      return reply.send(
        rows.map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description,
          status: f.status,
          proposer: f.proposedBy.displayName,
          voteCount: f._count.votes,
          youVoted: f.votes.length > 0,
          commentCount: f._count.comments,
          reviewNote: f.reviewNote,
          reviewedAt: f.reviewedAt,
          mergedIntoId: f.mergedIntoId,
          mergedIntoTitle: f.mergedInto?.title ?? null,
          createdAt: f.createdAt,
        })),
      )
    },
  )

  // POST /api/v1/governance/feature-requests — any member can propose
  fastify.post(
    '/api/v1/governance/feature-requests',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 201, schema: FeatureRequestSummarySchema, name: 'FeatureRequestCreated' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateFeatureRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const created = await fastify.prisma.featureRequest.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          proposedById: user.id,
        },
        include: { proposedBy: { select: { displayName: true } } },
      })

      await auditLog(fastify.prisma, {
        action: 'FEATURE_REQUEST_CREATE',
        actorId: user.id,
        targetId: created.id,
        meta: { title: created.title },
      })

      return reply.status(201).send({
        id: created.id,
        title: created.title,
        description: created.description,
        status: created.status,
        proposer: created.proposedBy.displayName,
        voteCount: 0,
        youVoted: false,
        commentCount: 0,
        reviewNote: null,
        reviewedAt: null,
        mergedIntoId: null,
        mergedIntoTitle: null,
        createdAt: created.createdAt,
      })
    },
  )

  // POST /api/v1/governance/feature-requests/:id/vote
  fastify.post(
    '/api/v1/governance/feature-requests/:id/vote',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 201, schema: VoteFeatureRequestResponseSchema, name: 'FeatureRequestVoteCast' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const feature = await fastify.prisma.featureRequest.findUnique({
        where: { id },
        select: { id: true, status: true },
      })
      if (!feature) return reply.status(404).send({ error: 'Feature request not found' })
      if (feature.status === 'DUPLICATE') {
        return reply.status(409).send({ error: 'Vote on the original request instead' })
      }

      const existing = await fastify.prisma.featureRequestVote.findUnique({
        where: { featureRequestId_userId: { featureRequestId: id, userId: user.id } },
      })
      if (existing) {
        return reply.status(409).send({ error: 'You already voted for this' })
      }

      await fastify.prisma.featureRequestVote.create({
        data: { featureRequestId: id, userId: user.id },
      })
      const voteCount = await fastify.prisma.featureRequestVote.count({
        where: { featureRequestId: id },
      })

      await auditLog(fastify.prisma, {
        action: 'FEATURE_REQUEST_VOTE',
        actorId: user.id,
        targetId: id,
      })

      return reply.status(201).send({ ok: true as const, voteCount })
    },
  )

  // DELETE /api/v1/governance/feature-requests/:id/vote
  fastify.delete(
    '/api/v1/governance/feature-requests/:id/vote',
    { preHandler: requireMember },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const existing = await fastify.prisma.featureRequestVote.findUnique({
        where: { featureRequestId_userId: { featureRequestId: id, userId: user.id } },
      })
      if (!existing) return reply.status(404).send({ error: 'You have not voted for this' })

      await fastify.prisma.featureRequestVote.delete({
        where: { featureRequestId_userId: { featureRequestId: id, userId: user.id } },
      })
      const voteCount = await fastify.prisma.featureRequestVote.count({
        where: { featureRequestId: id },
      })

      await auditLog(fastify.prisma, {
        action: 'FEATURE_REQUEST_UNVOTE',
        actorId: user.id,
        targetId: id,
      })

      return reply.send({ ok: true as const, voteCount })
    },
  )

  // GET /api/v1/governance/feature-requests/:id/comments
  fastify.get(
    '/api/v1/governance/feature-requests/:id/comments',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(FeatureRequestCommentListSchema, 'FeatureRequestCommentList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const feature = await fastify.prisma.featureRequest.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!feature) return reply.status(404).send({ error: 'Feature request not found' })

      const comments = await fastify.prisma.featureRequestComment.findMany({
        where: { featureRequestId: id },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { displayName: true } } },
      })

      return reply.send(
        comments.map((c) => ({
          id: c.id.toString(),
          body: c.body,
          authorId: c.authorId,
          authorDisplayName: c.author?.displayName ?? null,
          createdAt: c.createdAt,
        })),
      )
    },
  )

  // POST /api/v1/governance/feature-requests/:id/comments
  fastify.post(
    '/api/v1/governance/feature-requests/:id/comments',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 201, schema: FeatureRequestCommentSchema, name: 'FeatureRequestComment' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = PostFeatureRequestCommentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const feature = await fastify.prisma.featureRequest.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!feature) return reply.status(404).send({ error: 'Feature request not found' })

      const comment = await fastify.prisma.featureRequestComment.create({
        data: { featureRequestId: id, authorId: user.id, body: parsed.data.body },
        include: { author: { select: { displayName: true } } },
      })

      await auditLog(fastify.prisma, {
        action: 'FEATURE_REQUEST_COMMENT_CREATE',
        actorId: user.id,
        targetId: id,
      })

      return reply.status(201).send({
        id: comment.id.toString(),
        body: comment.body,
        authorId: comment.authorId,
        authorDisplayName: comment.author?.displayName ?? null,
        createdAt: comment.createdAt,
      })
    },
  )
}

export default featureRequestsRoutes
