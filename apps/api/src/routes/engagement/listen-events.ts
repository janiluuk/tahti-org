// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@tahti/db'
import { RecordListenResponseSchema, RecordListenSchema, openApiResponse } from '@tahti/shared'

// In-memory rate limit: max 60 listen-events per listener per hour — bounds
// abuse (rapidly "voting" for many tracks) without constraining a genuine
// listening session, since real dedup already caps it to 1/track/day anyway.
const listenBucket = new Map<string, { count: number; reset: number }>()

function checkListenLimit(key: string): boolean {
  const now = Date.now()
  const entry = listenBucket.get(key)
  if (!entry || now > entry.reset) {
    listenBucket.set(key, { count: 1, reset: now + 60 * 60_000 })
    return true
  }
  if (entry.count >= 60) return false
  entry.count++
  return true
}

const pruneTimer = setInterval(() => {
  const now = Date.now()
  for (const [k, v] of listenBucket) {
    if (now > v.reset) listenBucket.delete(k)
  }
}, 60_000)
pruneTimer.unref()

function todayUtcBucket(): string {
  return new Date().toISOString().slice(0, 10)
}

const listenEventsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/listen-events { soundId } — fired by the player once a
  // track has played long enough to count as a real listen. Never errors on
  // "not eligible"/"already counted" — those just return recorded: false.
  fastify.post(
    '/api/listen-events',
    { schema: { response: openApiResponse(RecordListenResponseSchema, 'RecordListen') } },
    async (request, reply) => {
      const parsed = RecordListenSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const dedupeKey = request.sessionUser
        ? `user:${request.sessionUser.id}`
        : `anon:${createHash('sha256')
            .update(`${request.ip ?? '0.0.0.0'}:${(request.headers['user-agent'] as string) ?? ''}`)
            .digest('hex')
            .slice(0, 16)}`

      if (!checkListenLimit(dedupeKey)) {
        return reply.send({ recorded: false })
      }

      const item = await fastify.prisma.sound.findUnique({
        where: { id: parsed.data.soundId },
        select: { id: true, isPublic: true, status: true, topListsEligible: true },
      })
      if (!item || !item.isPublic || item.status !== 'READY' || !item.topListsEligible) {
        return reply.send({ recorded: false })
      }

      try {
        await fastify.prisma.listenEvent.create({
          data: { soundId: item.id, dedupeKey, dayBucket: todayUtcBucket() },
        })
        return reply.send({ recorded: true })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply.send({ recorded: false })
        }
        throw err
      }
    },
  )
}

export default listenEventsRoutes
