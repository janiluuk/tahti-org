// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { FanTierBodySchema, FanTierPatchSchema } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { stripeEnabled } from '../../lib/stripe.js'

const fanTierRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/u/:username/tiers — public, active tiers for the subscribe page
  fastify.get('/api/v1/u/:username/tiers', async (request, reply) => {
    const { username } = request.params as { username: string }
    const artist = await fastify.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        displayName: true,
        username: true,
        bio: true,
        avatarUrl: true,
        stripeConnectChargesEnabled: true,
      },
    })
    if (!artist) return reply.status(404).send({ error: 'Artist not found' })

    const tiers = await fastify.prisma.fanTier.findMany({
      where: { artistUserId: artist.id, active: true },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, amountCents: true, description: true, perks: true },
    })

    const paymentsReady = !stripeEnabled || artist.stripeConnectChargesEnabled

    return reply.send({
      artist: {
        id: artist.id,
        displayName: artist.displayName,
        username: artist.username,
        bio: artist.bio,
        avatarUrl: artist.avatarUrl,
      },
      tiers,
      paymentsReady,
    })
  })

  // GET /api/me/fan-tiers — the signed-in artist's own tiers (incl. disabled)
  fastify.get('/api/me/fan-tiers', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const tiers = await fastify.prisma.fanTier.findMany({
      where: { artistUserId: user.id },
      orderBy: { position: 'asc' },
    })
    return reply.send(tiers)
  })

  // POST /api/me/fan-tiers — create a tier
  fastify.post('/api/me/fan-tiers', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = FanTierBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }

    const count = await fastify.prisma.fanTier.count({ where: { artistUserId: user.id } })
    if (count >= 8) return reply.status(400).send({ error: 'Maximum of 8 tiers' })

    const tier = await fastify.prisma.fanTier.create({
      data: {
        artistUserId: user.id,
        name: parsed.data.name,
        amountCents: parsed.data.amountCents,
        description: parsed.data.description,
        perks: parsed.data.perks,
        position: count,
      },
    })
    return reply.status(201).send(tier)
  })

  // PATCH /api/me/fan-tiers/:id — update or enable/disable a tier
  fastify.patch('/api/me/fan-tiers/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }
    const parsed = FanTierPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }
    const body = parsed.data

    const existing = await fastify.prisma.fanTier.findFirst({
      where: { id, artistUserId: user.id },
    })
    if (!existing) return reply.status(404).send({ error: 'Tier not found' })

    const data: Record<string, unknown> = {}
    const tierFieldsTouched =
      body.name !== undefined ||
      body.amountCents !== undefined ||
      body.perks !== undefined ||
      body.description !== undefined

    if (tierFieldsTouched) {
      const merged = FanTierBodySchema.safeParse({
        name: body.name ?? existing.name,
        amountCents: body.amountCents ?? existing.amountCents,
        description:
          body.description !== undefined ? body.description : (existing.description ?? undefined),
        perks: body.perks ?? existing.perks,
      })
      if (!merged.success) {
        return reply.status(400).send({ error: merged.error.issues[0]?.message ?? 'Invalid body' })
      }
      Object.assign(data, merged.data)
    }
    if (body.active !== undefined) data.active = body.active
    if (body.position !== undefined) data.position = body.position

    const tier = await fastify.prisma.fanTier.update({ where: { id }, data })
    return reply.send(tier)
  })
}

export default fanTierRoutes
