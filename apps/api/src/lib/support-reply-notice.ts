// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { config } from '../config.js'
import { sendMail } from './email.js'

const BODY_PREVIEW_LENGTH = 200

/** Tells whoever opened a support ticket that the board replied: a
 * notification and an email for an account, an email alone for a request sent
 * while signed out. A board member replying on their own ticket is not told.
 * Never throws — the reply is already saved. */
export async function notifyRequesterOfSupportReply(
  prisma: PrismaClient,
  ticketId: bigint,
  reply: { body: string; authorId: string },
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        subject: true,
        contactEmail: true,
        artist: { select: { id: true, email: true, emailVerifiedAt: true, deletedAt: true } },
      },
    })
    if (!ticket) return
    const requester = ticket.artist
    if (requester && (requester.deletedAt || requester.id === reply.authorId)) return

    const title = `Tahti support replied to "${ticket.subject}"`
    const helpUrl = `${config.appUrl.replace(/\/$/, '')}/help`

    if (requester) {
      await prisma.notification.create({
        data: {
          userId: requester.id,
          type: 'SUPPORT_REPLY',
          title,
          body: reply.body.slice(0, BODY_PREVIEW_LENGTH),
          url: '/help',
        },
      })
    }

    const to = requester
      ? requester.emailVerifiedAt
        ? requester.email
        : null
      : ticket.contactEmail
    if (!to) return
    await sendMail({
      to,
      subject: `Tahti · Re: ${ticket.subject}`,
      text: requester ? `${reply.body}\n\nSee the whole conversation: ${helpUrl}` : reply.body,
    })
  } catch (err) {
    log.warn({ err, ticketId: ticketId.toString() }, 'support reply notice failed')
  }
}

/** Tells whoever opened a support ticket that the board marked it resolved,
 * the same way a reply reaches them, with a pointer to reopen it by
 * replying. A board member resolving their own ticket is not told. Never
 * throws — the status change is already saved. */
export async function notifyRequesterOfSupportResolved(
  prisma: PrismaClient,
  ticketId: bigint,
  actorId: string,
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        subject: true,
        contactEmail: true,
        artist: { select: { id: true, email: true, emailVerifiedAt: true, deletedAt: true } },
      },
    })
    if (!ticket) return
    const requester = ticket.artist
    if (requester && (requester.deletedAt || requester.id === actorId)) return

    const title = `Your support request "${ticket.subject}" was resolved`
    const helpUrl = `${config.appUrl.replace(/\/$/, '')}/help`

    if (requester) {
      await prisma.notification.create({
        data: {
          userId: requester.id,
          type: 'SUPPORT_REPLY',
          title,
          body: 'Reply to it if something is still wrong and it opens again.',
          url: '/help',
        },
      })
    }

    const to = requester
      ? requester.emailVerifiedAt
        ? requester.email
        : null
      : ticket.contactEmail
    if (!to) return
    await sendMail({
      to,
      subject: `Tahti · Resolved: ${ticket.subject}`,
      text: requester
        ? `The Tahti board marked your support request resolved. If something is still wrong, reply to it and it opens again: ${helpUrl}`
        : 'The Tahti board marked your support request resolved. If something is still wrong, write to us again.',
    })
  } catch (err) {
    log.warn({ err, ticketId: ticketId.toString() }, 'support resolved notice failed')
  }
}
