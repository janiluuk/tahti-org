// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { Prisma } from '@tahti/db'
import type { JamSession, JamParticipant, User } from '@tahti/db'
import {
  CreateJamSessionSchema,
  JamStateUpdateSchema,
  JamTrackSchema,
  type JamSessionView,
  type JamTrack,
  openApiResponse,
  JamSessionViewSchema,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { generateJamCode } from '../../lib/jam-code.js'
import { publishToJam, subscribeToJam } from '../../lib/jam-broadcast.js'

const sessionWithParticipants = {
  include: {
    participants: {
      where: { leftAt: null },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    },
  },
} satisfies Prisma.JamSessionDefaultArgs

type SessionWithParticipants = JamSession & {
  participants: (JamParticipant & {
    user: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>
  })[]
}

/** `currentTrackJson` is trusted here — it's never round-tripped from the
 * client as raw JSON, only ever written by the /state handler below from an
 * already-validated JamStateUpdateSchema parse. */
function currentTrackFrom(json: unknown): JamTrack | null {
  if (json === null || json === undefined) return null
  const parsed = JamTrackSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

function serialize(session: SessionWithParticipants): JamSessionView {
  return {
    id: session.id,
    code: session.code,
    hostUserId: session.hostUserId,
    collectionId: session.collectionId,
    isPlaying: session.isPlaying,
    currentTrack: currentTrackFrom(session.currentTrackJson),
    positionSec: session.positionSec,
    positionUpdatedAt: session.positionUpdatedAt,
    createdAt: session.createdAt,
    endedAt: session.endedAt,
    participants: session.participants.map((p) => ({
      userId: p.user.id,
      username: p.user.username,
      displayName: p.user.displayName,
      avatarUrl: p.user.avatarUrl,
      role: p.role,
      canControl: p.canControl,
      joinedAt: p.joinedAt,
    })),
  }
}

const jamRoute: FastifyPluginAsync = async (fastify) => {
  async function loadActiveSession(id: string): Promise<SessionWithParticipants | null> {
    return fastify.prisma.jamSession.findFirst({
      where: { id, endedAt: null },
      ...sessionWithParticipants,
    })
  }

  /** Loads a session the caller is an active (non-left) participant of, or
   * sends 404 and returns null — same "don't reveal whether it exists"
   * shape as every other owned-resource lookup in this API. */
  async function requireParticipant(
    request: FastifyRequest,
    id: string,
  ): Promise<SessionWithParticipants | null> {
    const session = await loadActiveSession(id)
    if (!session) return null
    const isParticipant = session.participants.some((p) => p.userId === request.sessionUser!.id)
    return isParticipant ? session : null
  }

  // POST /api/v1/jam — start a jam from one of your own or a public playlist.
  fastify.post(
    '/api/v1/jam',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['jam'],
        summary: 'Start a Tahti Jam session from a playlist',
        response: openApiResponse(JamSessionViewSchema, 'JamSessionView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateJamSessionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const collection = await fastify.prisma.collection.findUnique({
        where: { slug: parsed.data.collectionSlug },
        select: { id: true, isPublic: true, userId: true },
      })
      if (!collection || (!collection.isPublic && collection.userId !== user.id)) {
        return reply.status(404).send({ error: 'Playlist not found' })
      }

      let code = generateJamCode()
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const clash = await fastify.prisma.jamSession.findUnique({ where: { code } })
        if (!clash) break
        code = generateJamCode()
      }

      const session = await fastify.prisma.jamSession.create({
        data: {
          hostUserId: user.id,
          collectionId: collection.id,
          code,
          participants: {
            create: { userId: user.id, role: 'HOST', canControl: true },
          },
        },
        ...sessionWithParticipants,
      })

      return reply.status(201).send(serialize(session))
    },
  )

  // POST /api/v1/jam/:code/join — idempotent: revisiting your own join link
  // (or the host opening it) just returns the current session.
  fastify.post(
    '/api/v1/jam/:code/join',
    {
      preHandler: requireAuth,
      schema: { tags: ['jam'], summary: 'Join a Tahti Jam session by its code' },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const { code } = request.params as { code: string }

      const session = await fastify.prisma.jamSession.findFirst({
        where: { code: code.toUpperCase(), endedAt: null },
        ...sessionWithParticipants,
      })
      if (!session) return reply.status(404).send({ error: 'Jam not found' })

      const already = session.participants.some((p) => p.userId === user.id)
      if (!already) {
        await fastify.prisma.jamParticipant.upsert({
          where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
          create: { sessionId: session.id, userId: user.id, role: 'GUEST', canControl: false },
          // Rejoining after having left earlier: welcome back, same seat.
          update: { leftAt: null },
        })
      }

      const fresh = await loadActiveSession(session.id)
      const view = serialize(fresh!)
      publishToJam(session.id, { type: 'state', session: view })
      return reply.send(view)
    },
  )

  // GET /api/v1/jam/:id — current snapshot, for the initial page load before
  // the SSE connection opens (and for reconnects).
  fastify.get(
    '/api/v1/jam/:id',
    {
      preHandler: requireAuth,
      schema: { tags: ['jam'], response: openApiResponse(JamSessionViewSchema, 'JamSessionView') },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const session = await requireParticipant(request, id)
      if (!session) return reply.status(404).send({ error: 'Jam not found' })
      return reply.send(serialize(session))
    },
  )

  // GET /api/v1/jam/:id/events — SSE stream of session state, pushed
  // whenever the host reports a change (see POST .../state below).
  fastify.get(
    '/api/v1/jam/:id/events',
    { preHandler: requireAuth, schema: { tags: ['jam'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const session = await requireParticipant(request, id)
      if (!session) return reply.status(404).send({ error: 'Jam not found' })

      reply.hijack()
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      })
      reply.raw.write(`data: ${JSON.stringify({ type: 'state', session: serialize(session) })}\n\n`)

      const unsubscribe = subscribeToJam(id, (event) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      })
      // Comment-only pings keep intermediaries (proxies, browsers) from
      // treating an idle-but-open jam as a dead connection.
      const keepAlive = setInterval(() => reply.raw.write(': ping\n\n'), 20_000)
      request.raw.on('close', () => {
        clearInterval(keepAlive)
        unsubscribe()
      })
    },
  )

  // POST /api/v1/jam/:id/state — host-only: reports current playback.
  fastify.post(
    '/api/v1/jam/:id/state',
    { preHandler: requireAuth, schema: { tags: ['jam'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      const { id } = request.params as { id: string }
      const parsed = JamStateUpdateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const existing = await loadActiveSession(id)
      if (!existing) return reply.status(404).send({ error: 'Jam not found' })
      if (existing.hostUserId !== user.id) {
        return reply.status(403).send({ error: 'Only the host can report playback state' })
      }

      const session = await fastify.prisma.jamSession.update({
        where: { id },
        data: {
          isPlaying: parsed.data.isPlaying,
          currentTrackJson: parsed.data.currentTrack ?? Prisma.JsonNull,
          positionSec: parsed.data.positionSec,
          positionUpdatedAt: new Date(),
        },
        ...sessionWithParticipants,
      })

      const view = serialize(session)
      publishToJam(id, { type: 'state', session: view })
      return reply.send(view)
    },
  )

  // POST /api/v1/jam/:id/leave — self-removal; the host leaving does not end
  // the session (use DELETE for that) so a flaky connection doesn't kill a
  // jam everyone else is still enjoying.
  fastify.post(
    '/api/v1/jam/:id/leave',
    { preHandler: requireAuth, schema: { tags: ['jam'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      const { id } = request.params as { id: string }

      const participant = await fastify.prisma.jamParticipant.findUnique({
        where: { sessionId_userId: { sessionId: id, userId: user.id } },
      })
      if (!participant || participant.leftAt) return reply.status(404).send({ error: 'Not in this jam' })

      await fastify.prisma.jamParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() },
      })

      const fresh = await loadActiveSession(id)
      if (fresh) publishToJam(id, { type: 'state', session: serialize(fresh) })
      return reply.status(204).send()
    },
  )

  // DELETE /api/v1/jam/:id — host-only: ends the session for everyone.
  fastify.delete(
    '/api/v1/jam/:id',
    { preHandler: requireAuth, schema: { tags: ['jam'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      const { id } = request.params as { id: string }

      const session = await loadActiveSession(id)
      if (!session) return reply.status(404).send({ error: 'Jam not found' })
      if (session.hostUserId !== user.id) {
        return reply.status(403).send({ error: 'Only the host can end this jam' })
      }

      await fastify.prisma.jamSession.update({ where: { id }, data: { endedAt: new Date() } })
      publishToJam(id, { type: 'ended' })
      return reply.status(204).send()
    },
  )
}

export default jamRoute
