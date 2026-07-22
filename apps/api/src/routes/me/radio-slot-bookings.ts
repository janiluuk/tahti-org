// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@tahti/db'
import {
  CreateRadioSlotBookingSchema,
  IdParamSchema,
  RADIO_SLOT_MAX_ADVANCE_DAYS,
  RADIO_SLOT_MAX_HOURS,
  RADIO_SLOT_MAX_UPCOMING_PER_CHANNEL,
  RadioSlotBookingListQuerySchema,
  RadioSlotBookingListSchema,
  RadioSlotBookingItemSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const MS_PER_HOUR = 60 * 60 * 1000

/** Internal signal to abort the booking transaction — never leaves this file. */
class SlotConflictError extends Error {}

function isHourAligned(d: Date): boolean {
  return d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
}

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request' })
}

const meRadioSlotBookings: FastifyPluginAsync = async (fastify) => {
  async function ownChannel(userId: string) {
    return fastify.prisma.channel.findUnique({
      where: { userId },
      select: { id: true, slug: true },
    })
  }

  // GET /api/me/radio-slot-bookings?from=&to= — shared calendar view: every
  // artist's bookings in range, flagged isMine so the UI knows what can be cancelled.
  fastify.get(
    '/api/me/radio-slot-bookings',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(RadioSlotBookingListSchema, 'RadioSlotBookingList') },
    },
    async (request, reply) => {
      const parsed = RadioSlotBookingListQuerySchema.safeParse(request.query)
      if (!parsed.success) return zodError(reply, parsed.error)

      const from = new Date(parsed.data.from)
      const to = new Date(parsed.data.to)
      if (to <= from) return reply.status(400).send({ error: '"to" must be after "from"' })

      const channel = await ownChannel(request.sessionUser!.id)

      const rows = await fastify.prisma.radioSlotBooking.findMany({
        where: { startAt: { lt: to }, endAt: { gt: from } },
        orderBy: { startAt: 'asc' },
        include: { channel: { select: { slug: true, user: { select: { displayName: true } } } } },
      })

      return reply.send(
        rows.map((r) => ({
          id: r.id,
          startAt: r.startAt.toISOString(),
          endAt: r.endAt.toISOString(),
          note: r.note,
          channelSlug: r.channel.slug,
          displayName: r.channel.user.displayName,
          isMine: r.channelId === channel?.id,
        })),
      )
    },
  )

  // POST /api/me/radio-slot-bookings
  fastify.post(
    '/api/me/radio-slot-bookings',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(RadioSlotBookingItemSchema, 'RadioSlotBookingItem') },
    },
    async (request, reply) => {
      const parsed = CreateRadioSlotBookingSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true, slug: true, user: { select: { displayName: true } } },
      })
      if (!channel) {
        return reply.status(403).send({ error: 'You need a channel to book a live slot' })
      }

      const startAt = new Date(parsed.data.startAt)
      const endAt = new Date(parsed.data.endAt)
      const now = new Date()

      if (!isHourAligned(startAt) || !isHourAligned(endAt)) {
        return reply.status(400).send({ error: 'Slots must start and end on the hour' })
      }
      if (endAt <= startAt) {
        return reply.status(400).send({ error: '"endAt" must be after "startAt"' })
      }
      if (endAt.getTime() - startAt.getTime() > RADIO_SLOT_MAX_HOURS * MS_PER_HOUR) {
        return reply.status(400).send({ error: `Slots are ${RADIO_SLOT_MAX_HOURS}h max` })
      }
      if (startAt <= now) {
        return reply.status(400).send({ error: 'Slot must be in the future' })
      }
      if (startAt.getTime() - now.getTime() > RADIO_SLOT_MAX_ADVANCE_DAYS * 24 * MS_PER_HOUR) {
        return reply
          .status(400)
          .send({ error: `Slots open up to ${RADIO_SLOT_MAX_ADVANCE_DAYS} days ahead` })
      }

      const upcomingCount = await fastify.prisma.radioSlotBooking.count({
        where: { channelId: channel.id, startAt: { gt: now } },
      })
      if (upcomingCount >= RADIO_SLOT_MAX_UPCOMING_PER_CHANNEL) {
        return reply.status(409).send({
          error: `You can have at most ${RADIO_SLOT_MAX_UPCOMING_PER_CHANNEL} upcoming bookings`,
        })
      }

      // Serializable so two near-simultaneous requests for overlapping windows can't
      // both pass the overlap check and both insert — Postgres aborts one with a
      // write-conflict (caught below) instead of silently double-booking the slot.
      let row
      try {
        row = await fastify.prisma.$transaction(
          async (tx) => {
            const overlap = await tx.radioSlotBooking.findFirst({
              where: { startAt: { lt: endAt }, endAt: { gt: startAt } },
            })
            if (overlap) {
              throw new SlotConflictError()
            }
            return tx.radioSlotBooking.create({
              data: { channelId: channel.id, startAt, endAt, note: parsed.data.note ?? null },
            })
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
      } catch (err) {
        if (err instanceof SlotConflictError) {
          return reply.status(409).send({ error: 'That slot is already booked' })
        }
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
          return reply
            .status(409)
            .send({ error: 'That slot was just booked by someone else — try another time' })
        }
        throw err
      }

      return reply.status(201).send({
        id: row.id,
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        note: row.note,
        channelSlug: channel.slug,
        displayName: channel.user.displayName,
        isMine: true,
      })
    },
  )

  // DELETE /api/me/radio-slot-bookings/:id
  fastify.delete(
    '/api/me/radio-slot-bookings/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await ownChannel(request.sessionUser!.id)
      if (!channel) return reply.status(403).send({ error: 'You need a channel to do this' })

      const existing = await fastify.prisma.radioSlotBooking.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
        select: { id: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Booking not found' })

      await fastify.prisma.radioSlotBooking.delete({ where: { id: existing.id } })
      return reply.status(204).send()
    },
  )
}

export default meRadioSlotBookings
