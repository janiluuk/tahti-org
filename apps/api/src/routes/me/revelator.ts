// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  RevelatorBillingStatusSchema,
  RevelatorCheckoutResponseSchema,
  RevelatorReleaseStatusSchema,
  RevelatorRoyaltyReportsSchema,
  RevelatorSubmitAcceptedSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { releaseCatalogSelect } from '../../lib/release-catalog.js'
import { config } from '../../config.js'
import {
  getDistributionBillingStatus,
  recordDistributionPayment,
} from '../../lib/distribution-billing.js'
import { createCheckoutSession, stripeEnabled } from '../../lib/stripe.js'
import { getRevelatorReleaseStatus, submitRevelatorRelease } from '../../lib/revelator-delivery.js'

async function loadOwnedRelease(
  fastify: { prisma: import('@tahti/db').PrismaClient },
  userId: string,
  id: string,
) {
  return fastify.prisma.release.findFirst({
    where: { id, userId },
    select: {
      ...releaseCatalogSelect,
      userId: true,
      distributionPaidAt: true,
      distributionFeeCents: true,
      user: { select: { email: true } },
    },
  })
}

// M7 — Revelator DSP submission (wizard entry point)
const revelatorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/releases/:id/revelator',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M7: Revelator submission status for a release',
        response: openApiResponse(RevelatorReleaseStatusSchema, 'RevelatorReleaseStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const result = await getRevelatorReleaseStatus(fastify.prisma, user.id, id)
      if (!result.ok) return reply.status(404).send({ error: 'Release not found' })

      return reply.send({
        revelatorId: result.revelatorId,
        revelatorStatus: result.revelatorStatus,
        title: result.title,
      })
    },
  )

  fastify.get(
    '/api/me/releases/:id/revelator/billing',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M7: distribution fee status before Revelator submit',
        response: openApiResponse(RevelatorBillingStatusSchema, 'RevelatorBillingStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const release = await fastify.prisma.release.findFirst({
        where: { id, userId: user.id },
        select: {
          distributionPaidAt: true,
          distributionFeeCents: true,
        },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const billing = await getDistributionBillingStatus(
        fastify.prisma,
        user.id,
        user.tier,
        release,
      )
      return reply.send(billing)
    },
  )

  fastify.post(
    '/api/me/releases/:id/revelator/checkout',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M7: pay distribution fee or consume Studio included slot',
        response: openApiResponse(RevelatorCheckoutResponseSchema, 'RevelatorCheckoutResponse'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const release = await loadOwnedRelease(fastify, user.id, id)
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      if (release.tracks.length < 1) {
        return reply.status(400).send({ error: 'Add at least one track before DSP checkout' })
      }

      const billing = await getDistributionBillingStatus(
        fastify.prisma,
        user.id,
        user.tier,
        release,
      )
      if (billing.paid) {
        return reply.send({
          paid: true as const,
          feeCents: billing.feeCents,
          waived: billing.waived,
        })
      }

      const sessionId = `dev_distribution_${id}_${Date.now()}`

      if (billing.feeCents === 0) {
        await recordDistributionPayment(fastify.prisma, {
          releaseId: id,
          userId: user.id,
          amountCents: 0,
          stripeSessionId: sessionId,
        })
        return reply.send({ paid: true as const, feeCents: 0, waived: true })
      }

      if (!stripeEnabled) {
        await recordDistributionPayment(fastify.prisma, {
          releaseId: id,
          userId: user.id,
          amountCents: billing.feeCents,
          stripeSessionId: sessionId,
        })
        return reply.send({
          paid: true as const,
          feeCents: billing.feeCents,
          waived: false,
        })
      }

      try {
        const session = await createCheckoutSession({
          customerEmail: release.user.email,
          successUrl: `${config.appUrl}/dashboard?distribution=success&releaseId=${id}`,
          cancelUrl: `${config.appUrl}/dashboard?distribution=canceled&releaseId=${id}`,
          unitAmountCents: billing.feeCents,
          productName: `DSP distribution — ${release.title}`,
          metadata: {
            type: 'distribution',
            releaseId: id,
            userId: user.id,
          },
        })
        return reply.send({ checkoutUrl: session.url, sessionId: session.id })
      } catch (err) {
        request.log.error({ err }, 'distribution checkout failed')
        return reply.status(502).send({ error: 'Could not start checkout' })
      }
    },
  )

  fastify.post(
    '/api/me/releases/:id/revelator/submit',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M7: queue Revelator DSP delivery for a release',
        response: openApiResponses([
          { status: 202, schema: RevelatorSubmitAcceptedSchema, name: 'RevelatorSubmitAccepted' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const result = await submitRevelatorRelease(fastify.prisma, user.id, id)
      if (!result.ok) {
        return reply.status(result.status).send({
          error: result.error,
          ...(result.revelatorStatus !== undefined
            ? { revelatorStatus: result.revelatorStatus, revelatorId: result.revelatorId }
            : {}),
        })
      }

      return reply.status(202).send({
        releaseId: result.releaseId,
        revelatorStatus: result.revelatorStatus,
      })
    },
  )

  fastify.get(
    '/api/me/releases/:id/revelator/royalties',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M7: Revelator royalty reports synced for a release',
        response: openApiResponse(RevelatorRoyaltyReportsSchema, 'RevelatorRoyaltyReports'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const release = await fastify.prisma.release.findFirst({
        where: { id, userId: user.id },
        select: { id: true, title: true },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const rows = await fastify.prisma.revelatorRoyaltyReport.findMany({
        where: { releaseId: id, userId: user.id },
        orderBy: { periodEnd: 'desc' },
        take: 24,
        select: {
          id: true,
          releaseId: true,
          periodStart: true,
          periodEnd: true,
          amountCents: true,
          currency: true,
          streams: true,
          syncedAt: true,
        },
      })

      return reply.send({
        reports: rows.map((row) => ({
          id: row.id,
          releaseId: row.releaseId,
          releaseTitle: release.title,
          periodStart: row.periodStart.toISOString().slice(0, 10),
          periodEnd: row.periodEnd.toISOString().slice(0, 10),
          amountCents: row.amountCents,
          currency: row.currency,
          streams: row.streams,
          syncedAt: row.syncedAt.toISOString(),
        })),
      })
    },
  )

  fastify.get(
    '/api/me/revelator/royalties',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M7: all Revelator royalty reports for the signed-in artist',
        response: openApiResponse(RevelatorRoyaltyReportsSchema, 'RevelatorRoyaltyReports'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const rows = await fastify.prisma.revelatorRoyaltyReport.findMany({
        where: { userId: user.id },
        orderBy: { periodEnd: 'desc' },
        take: 48,
        select: {
          id: true,
          releaseId: true,
          periodStart: true,
          periodEnd: true,
          amountCents: true,
          currency: true,
          streams: true,
          syncedAt: true,
          release: { select: { title: true } },
        },
      })

      return reply.send({
        reports: rows.map((row) => ({
          id: row.id,
          releaseId: row.releaseId,
          releaseTitle: row.release.title,
          periodStart: row.periodStart.toISOString().slice(0, 10),
          periodEnd: row.periodEnd.toISOString().slice(0, 10),
          amountCents: row.amountCents,
          currency: row.currency,
          streams: row.streams,
          syncedAt: row.syncedAt.toISOString(),
        })),
      })
    },
  )
}

export default revelatorRoutes
