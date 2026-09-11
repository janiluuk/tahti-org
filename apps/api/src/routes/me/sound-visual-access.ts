// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SoundVisualPatchSchema,
  ArchiveItemAccessPatchSchema,
  IdParamSchema,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meSoundVisualAccessRoutes: FastifyPluginAsync = async (fastify) => {
  // M31: PLAT-074 — sound item visual preset
  fastify.patch('/api/me/sound/:id/visual', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const parsed = SoundVisualPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }

    const item = await fastify.prisma.sound.findFirst({
      where: { id: routeParams.id, channel: { userId: user.id } },
      select: { id: true },
    })
    if (!item) return reply.status(404).send({ error: 'Sound item not found' })

    const updated = await fastify.prisma.sound.update({
      where: { id: item.id },
      data: {
        ...(parsed.data.visualPreset !== undefined
          ? { visualPreset: parsed.data.visualPreset }
          : {}),
        ...(parsed.data.colorScheme !== undefined
          ? {
              colorSchemeJson: parsed.data.colorScheme
                ? JSON.stringify(parsed.data.colorScheme)
                : null,
            }
          : {}),
      },
      select: { visualPreset: true, colorSchemeJson: true },
    })
    return reply.send(updated)
  })

  // Per-track paywall: gate a track behind an active fan subscription or a
  // one-time PurchaseTier. See apps/api/src/lib/purchase-tiers.ts.
  fastify.patch('/api/me/sound/:id/access', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const parsed = ArchiveItemAccessPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }

    const item = await fastify.prisma.sound.findFirst({
      where: { id: routeParams.id, channel: { userId: user.id } },
      select: { id: true },
    })
    if (!item) return reply.status(404).send({ error: 'Sound not found' })

    if (parsed.data.accessMode === 'PURCHASE') {
      if (!parsed.data.purchaseTierId) {
        return reply.status(400).send({ error: 'purchaseTierId is required for PURCHASE access' })
      }
      const tier = await fastify.prisma.purchaseTier.findFirst({
        where: { id: parsed.data.purchaseTierId, artistUserId: user.id },
        select: { id: true },
      })
      if (!tier) return reply.status(404).send({ error: 'Tier not found' })
    }

    const updated = await fastify.prisma.sound.update({
      where: { id: item.id },
      data: {
        accessMode: parsed.data.accessMode,
        purchaseTierId: parsed.data.accessMode === 'PURCHASE' ? parsed.data.purchaseTierId : null,
      },
      select: { accessMode: true, purchaseTierId: true },
    })
    return reply.send(updated)
  })
}

export default meSoundVisualAccessRoutes
