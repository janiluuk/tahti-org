// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { safeDisplayName } from '@tahti/shared'
import { config } from '../config.js'
import { sendMail } from './email.js'

const REMIND_AFTER_MS = 24 * 60 * 60 * 1000

/** Tells a fan that a renewal payment for their subscription failed, so they
 * can update their card before access ends. Stripe retries a failed invoice
 * several times; the fan hears about it at most once a day per artist. Never
 * throws — the webhook must still acknowledge the event. */
export async function notifyFanOfFailedPayment(
  prisma: PrismaClient,
  stripeSubscriptionId: string,
  log: { warn: (obj: unknown, msg: string) => void },
  now: Date = new Date(),
): Promise<void> {
  try {
    const sub = await prisma.fanSubscription.findUnique({
      where: { stripeSubscriptionId },
      select: {
        subscriberUserId: true,
        artistUserId: true,
        tierName: true,
        artist: { select: { username: true, displayName: true } },
        subscriber: { select: { email: true, emailVerifiedAt: true, deletedAt: true } },
      },
    })
    if (!sub || sub.subscriber.deletedAt) return

    const recent = await prisma.notification.findFirst({
      where: {
        userId: sub.subscriberUserId,
        actorUserId: sub.artistUserId,
        type: 'FAN_SUB_PAYMENT_FAILED',
        createdAt: { gte: new Date(now.getTime() - REMIND_AFTER_MS) },
      },
      select: { id: true },
    })
    if (recent) return

    const artist = safeDisplayName(sub.artist.displayName, sub.artist.username)
    const title = `Your payment for ${artist}'s ${sub.tierName} subscription failed`
    const body = 'Update your card to keep your fan access.'
    await prisma.notification.create({
      data: {
        userId: sub.subscriberUserId,
        type: 'FAN_SUB_PAYMENT_FAILED',
        actorUserId: sub.artistUserId,
        title,
        body,
        url: '/account',
      },
    })
    if (sub.subscriber.emailVerifiedAt) {
      await sendMail({
        to: sub.subscriber.email,
        subject: `Tahti · ${title}`,
        text: `${title}.\n${body}\n\n${config.appUrl.replace(/\/$/, '')}/account`,
      })
    }
  } catch (err) {
    log.warn({ err, stripeSubscriptionId }, 'failed-payment notice failed')
  }
}
