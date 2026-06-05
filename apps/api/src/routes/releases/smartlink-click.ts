// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { SmartLinkClickSchema } from '@tahti/shared'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

/** Phase 9 — per-platform smart link click logging (M14 analytics). */
const smartlinkClickRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/smartlink/click', async (request, reply) => {
    const parsed = SmartLinkClickSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)

    const { smartLinkSlug, platform, referer } = parsed.data

    const release = await fastify.prisma.release.findFirst({
      where: { smartLinkSlug, state: 'PUBLISHED' },
      select: { id: true },
    })

    if (!release) return reply.status(404).send({ error: 'Release not found' })

    await fastify.prisma.smartLinkClick.create({
      data: {
        releaseId: release.id,
        platform: platform.toLowerCase(),
        referer: referer?.slice(0, 2000) ?? null,
      },
    })

    return reply.send({ ok: true })
  })
}

export default smartlinkClickRoutes
