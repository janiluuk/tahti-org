// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  PurchaseCheckoutSchema,
  PurchaseTierBodySchema,
  PurchaseTierPatchSchema,
  StoreSettingsPatchSchema,
  UsernameParamSchema,
  UsernameTierIdParamsSchema,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  stripeEnabled,
  createStripeCustomer,
  createPurchaseCheckoutSession,
} from '../../lib/stripe.js'
import { recordPurchasePayment } from '../../lib/purchase-tiers.js'
import { config } from '../../config.js'

const MAX_TIERS = 8

const purchaseTierRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/u/:username/purchase-tiers — public, active tiers for the store section
  fastify.get('/api/v1/u/:username/purchase-tiers', async (request, reply) => {
    const routeParams = parseRouteParams(UsernameParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const artist = await fastify.prisma.user.findUnique({
      where: { username: routeParams.username },
      select: { id: true, stripeConnectChargesEnabled: true },
    })
    if (!artist) return reply.status(404).send({ error: 'Artist not found' })

    const tiers = await fastify.prisma.purchaseTier.findMany({
      where: { artistUserId: artist.id, active: true },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, description: true, priceCents: true, priceOptional: true },
    })
    const paymentsReady = !stripeEnabled || artist.stripeConnectChargesEnabled
    return reply.send({ tiers, paymentsReady })
  })

  // GET /api/me/purchase-tiers — the signed-in artist's own tiers (incl. disabled)
  fastify.get('/api/me/purchase-tiers', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const tiers = await fastify.prisma.purchaseTier.findMany({
      where: { artistUserId: user.id },
      orderBy: { position: 'asc' },
    })
    return reply.send(tiers)
  })

  // POST /api/me/purchase-tiers — create a tier
  fastify.post('/api/me/purchase-tiers', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = PurchaseTierBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }

    const count = await fastify.prisma.purchaseTier.count({ where: { artistUserId: user.id } })
    if (count >= MAX_TIERS)
      return reply.status(400).send({ error: `Maximum of ${MAX_TIERS} tiers` })

    const tier = await fastify.prisma.purchaseTier.create({
      data: {
        artistUserId: user.id,
        name: parsed.data.name,
        priceCents: parsed.data.priceCents,
        priceOptional: parsed.data.priceOptional,
        description: parsed.data.description,
        position: count,
      },
    })
    return reply.status(201).send(tier)
  })

  // PATCH /api/me/purchase-tiers/:id — update, or enable/disable a tier
  fastify.patch(
    '/api/me/purchase-tiers/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PurchaseTierPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const body = parsed.data

      const existing = await fastify.prisma.purchaseTier.findFirst({
        where: { id: routeParams.id, artistUserId: user.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Tier not found' })

      const data: Record<string, unknown> = {}
      if (body.name !== undefined) data.name = body.name
      if (body.priceCents !== undefined) data.priceCents = body.priceCents
      if (body.priceOptional !== undefined) data.priceOptional = body.priceOptional
      if (body.description !== undefined) data.description = body.description
      if (body.active !== undefined) data.active = body.active
      if (body.position !== undefined) data.position = body.position

      const tier = await fastify.prisma.purchaseTier.update({ where: { id: existing.id }, data })
      return reply.send(tier)
    },
  )

  // GET /api/me/purchase-tiers/orders — this artist's sales, for the studio Orders list
  fastify.get(
    '/api/me/purchase-tiers/orders',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const orders = await fastify.prisma.purchase.findMany({
        where: { artistUserId: user.id, state: 'PAID' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amountCents: true,
          createdAt: true,
          tier: { select: { id: true, name: true } },
          buyer: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      })
      return reply.send(orders)
    },
  )

  // POST /api/v1/u/:username/purchase-tiers/:tierId/checkout — buy a tier
  fastify.post(
    '/api/v1/u/:username/purchase-tiers/:tierId/checkout',
    { preHandler: requireAuth },
    async (request, reply) => {
      const buyer = request.sessionUser!
      const routeParams = parseRouteParams(UsernameTierIdParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsedBody = PurchaseCheckoutSchema.safeParse(request.body ?? {})
      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({ error: parsedBody.error.issues[0]?.message ?? 'Invalid body' })
      }

      const artist = await fastify.prisma.user.findUnique({
        where: { username: routeParams.username },
        select: { id: true, stripeConnectAccountId: true, stripeConnectChargesEnabled: true },
      })
      if (!artist) return reply.status(404).send({ error: 'Artist not found' })
      if (artist.id === buyer.id) {
        return reply.status(400).send({ error: 'You cannot buy your own tier' })
      }

      const tier = await fastify.prisma.purchaseTier.findFirst({
        where: { id: routeParams.tierId, artistUserId: artist.id, active: true },
      })
      if (!tier) return reply.status(404).send({ error: 'Tier not found' })

      const amountCents = tier.priceOptional
        ? (parsedBody.data.amountCents ?? tier.priceCents)
        : tier.priceCents
      if (amountCents < 0) return reply.status(400).send({ error: 'amountCents must be >= 0' })
      if (!tier.priceOptional && parsedBody.data.amountCents !== undefined) {
        return reply.status(400).send({ error: 'This tier has a fixed price' })
      }

      const purchase = await fastify.prisma.purchase.create({
        data: {
          tierId: tier.id,
          buyerUserId: buyer.id,
          artistUserId: artist.id,
          amountCents,
          state: 'PENDING',
        },
      })

      // Free claim (priceOptional, amount 0) — no Stripe involved at all.
      if (amountCents === 0) {
        await recordPurchasePayment(fastify.prisma, {
          purchaseId: purchase.id,
          amountCents: 0,
          stripeCheckoutSessionId: null,
        })
        return reply.status(201).send({ activated: true, purchaseId: purchase.id })
      }

      if (stripeEnabled) {
        if (!artist.stripeConnectAccountId || !artist.stripeConnectChargesEnabled) {
          return reply.status(503).send({ error: 'Purchases open soon for this artist' })
        }

        let customerId = buyer.stripeCustomerId
        if (!customerId) {
          try {
            customerId = await createStripeCustomer({ email: buyer.email, userId: buyer.id })
            await fastify.prisma.user.update({
              where: { id: buyer.id },
              data: { stripeCustomerId: customerId },
            })
          } catch (err) {
            request.log.error({ err }, 'purchase-tier customer creation failed')
            return reply.status(502).send({ error: 'Could not start checkout' })
          }
        }

        try {
          const session = await createPurchaseCheckoutSession({
            customerId,
            connectedAccountId: artist.stripeConnectAccountId,
            successUrl: `${config.appUrl}/u/${routeParams.username}?purchased=1`,
            cancelUrl: `${config.appUrl}/u/${routeParams.username}?canceled=1`,
            tierName: tier.name,
            amountCents,
            metadata: { type: 'purchase-tier', purchaseId: purchase.id },
          })
          return reply.send({ checkoutUrl: session.url, sessionId: session.id })
        } catch (err) {
          request.log.error({ err }, 'purchase-tier checkout failed')
          return reply.status(502).send({ error: 'Could not start checkout' })
        }
      }

      // Dev/test: activate immediately.
      await recordPurchasePayment(fastify.prisma, {
        purchaseId: purchase.id,
        amountCents,
        stripeCheckoutSessionId: `dev_${purchase.id}`,
      })
      return reply.status(201).send({ activated: true, purchaseId: purchase.id })
    },
  )

  // GET/PATCH /api/me/store-settings — whether the Store section (purchase
  // tiers) shows on this artist's public page.
  fastify.get('/api/me/store-settings', { preHandler: requireAuth }, async (request, reply) => {
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: request.sessionUser!.id },
      select: { storeEnabled: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    return reply.send(channel)
  })

  fastify.patch('/api/me/store-settings', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = StoreSettingsPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: request.sessionUser!.id },
      select: { id: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    const updated = await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: { storeEnabled: parsed.data.storeEnabled },
      select: { storeEnabled: true },
    })
    return reply.send(updated)
  })
}

export default purchaseTierRoutes
