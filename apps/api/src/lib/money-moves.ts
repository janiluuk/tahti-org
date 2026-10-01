// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { NotificationType, PrismaClient } from '@tahti/db'
import { config } from '../config.js'
import { sendMail } from './email.js'

/** "€5.00", the way money appears in artist-facing notices. */
export function formatEuros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

/** Tells an artist about money coming in, the way their "Money moves"
 * notification settings ask: an in-app notification and/or an email. Never
 * throws — a failed notice must not undo the payment that triggered it. */
export async function announceMoneyMove(
  prisma: PrismaClient,
  artistUserId: string,
  notice: {
    type: NotificationType
    actorUserId: string | null
    title: string
    url: string
  },
  log: { warn: (obj: unknown, msg: string) => void } = console,
): Promise<void> {
  try {
    const artist = await prisma.user.findUnique({
      where: { id: artistUserId },
      select: {
        email: true,
        emailVerifiedAt: true,
        deletedAt: true,
        notifyMoneyMovesInApp: true,
        notifyMoneyMovesEmail: true,
      },
    })
    if (!artist || artist.deletedAt) return

    if (artist.notifyMoneyMovesInApp) {
      await prisma.notification.create({
        data: {
          userId: artistUserId,
          type: notice.type,
          actorUserId: notice.actorUserId,
          title: notice.title,
          body: null,
          url: notice.url,
        },
      })
    }

    if (artist.notifyMoneyMovesEmail && artist.emailVerifiedAt) {
      const link = `${config.appUrl.replace(/\/$/, '')}${notice.url}`
      await sendMail({
        to: artist.email,
        subject: `Tahti · ${notice.title}`,
        text: `${notice.title}\n\n${link}\n\nYou can turn these emails off in Settings → Notifications.`,
      })
    }
  } catch (err) {
    log.warn({ err, artistUserId }, 'money-move notice failed')
  }
}
