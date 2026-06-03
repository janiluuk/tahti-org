// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

const MIN_CENTS = 100 // €1
const MAX_CENTS = 10000 // €100

function validateTier(body: {
  name?: string
  amountCents?: number
  description?: string
  perks?: unknown
}): { name: string; amountCents: number; description: string | null; perks: string[] } | string {
  const name = body.name?.trim()
  if (!name) return 'name is required'
  if (name.length > 60) return 'name must be 60 characters or fewer'
  if (
    typeof body.amountCents !== 'number' ||
    !Number.isInteger(body.amountCents) ||
    body.amountCents < MIN_CENTS ||
    body.amountCents > MAX_CENTS
  ) {
    return `amountCents must be an integer between ${MIN_CENTS} and ${MAX_CENTS}`
  }
  const description = body.description?.trim() ?? null
  if (description && description.length > 280) return 'description must be 280 characters or fewer'
  let perks: string[] = []
  if (body.perks !== undefined) {
    if (!Array.isArray(body.perks) || body.perks.some((p) => typeof p !== 'string')) {
      return 'perks must be an array of strings'
    }
    perks = (body.perks as string[])
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 5)
  }
  return { name, amountCents: body.amountCents, description, perks }
}

const fanTierRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/u/:username/tiers — public, active tiers for the subscribe page
  fastify.get('/api/v1/u/:username/tiers', async (request, reply) => {
    const { username } = request.params as { username: string }
    const artist = await fastify.prisma.user.findUnique({
      where: { username },
      select: { id: true, displayName: true, username: true, bio: true, avatarUrl: true },
    })
    if (!artist) return reply.status(404).send({ error: 'Artist not found' })

    const tiers = await fastify.prisma.fanTier.findMany({
      where: { artistUserId: artist.id, active: true },
      orderBy: { position: 'asc' },
      select: { id: true, name: true, amountCents: true, description: true, perks: true },
    })

    return reply.send({ artist, tiers })
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
    const parsed = validateTier(request.body as Record<string, unknown>)
    if (typeof parsed === 'string') return reply.status(400).send({ error: parsed })

    const count = await fastify.prisma.fanTier.count({ where: { artistUserId: user.id } })
    if (count >= 8) return reply.status(400).send({ error: 'Maximum of 8 tiers' })

    const tier = await fastify.prisma.fanTier.create({
      data: {
        artistUserId: user.id,
        name: parsed.name,
        amountCents: parsed.amountCents,
        description: parsed.description,
        perks: parsed.perks,
        position: count,
      },
    })
    return reply.status(201).send(tier)
  })

  // PATCH /api/me/fan-tiers/:id — update or enable/disable a tier
  fastify.patch('/api/me/fan-tiers/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }
    const body = request.body as Record<string, unknown> & { active?: boolean; position?: number }

    const existing = await fastify.prisma.fanTier.findFirst({
      where: { id, artistUserId: user.id },
    })
    if (!existing) return reply.status(404).send({ error: 'Tier not found' })

    const data: Record<string, unknown> = {}
    if (body.name !== undefined || body.amountCents !== undefined || body.perks !== undefined) {
      const parsed = validateTier({
        name: (body.name as string) ?? existing.name,
        amountCents: (body.amountCents as number) ?? existing.amountCents,
        description: (body.description as string) ?? existing.description ?? undefined,
        perks: (body.perks as string[]) ?? existing.perks,
      })
      if (typeof parsed === 'string') return reply.status(400).send({ error: parsed })
      Object.assign(data, parsed)
    } else if (body.description !== undefined) {
      data.description = (body.description as string)?.trim() || null
    }
    if (typeof body.active === 'boolean') data.active = body.active
    if (typeof body.position === 'number') data.position = body.position

    const tier = await fastify.prisma.fanTier.update({ where: { id }, data })
    return reply.send(tier)
  })
}

export default fanTierRoutes
