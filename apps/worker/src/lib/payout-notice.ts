// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { APP_URL, sendWorkerMail } from './mailer.js'

/** After a payout run, tells each artist how much was paid out to them in it —
 * one notice per artist, not one per fan payment — the way their "Money
 * moves" settings ask (in-app and/or email). */
export async function announcePayoutsSince(prisma: PrismaClient, since: Date) {
  const totals = await prisma.fanSubPayout.groupBy({
    by: ['artistUserId'],
    where: { state: 'PAID', paidAt: { gte: since } },
    _sum: { netToArtistCents: true },
    _count: { _all: true },
  })

  let announced = 0
  for (const row of totals) {
    const cents = row._sum.netToArtistCents ?? 0
    if (cents <= 0) continue
    const artist = await prisma.user.findUnique({
      where: { id: row.artistUserId },
      select: {
        email: true,
        emailVerifiedAt: true,
        deletedAt: true,
        notifyMoneyMovesInApp: true,
        notifyMoneyMovesEmail: true,
      },
    })
    if (!artist || artist.deletedAt) continue

    const title = `€${(cents / 100).toFixed(2)} paid out to you`
    const body = `From ${row._count._all} fan subscription payment${row._count._all === 1 ? '' : 's'}`
    try {
      if (artist.notifyMoneyMovesInApp) {
        await prisma.notification.create({
          data: {
            userId: row.artistUserId,
            type: 'PAYOUT_SENT',
            actorUserId: null,
            title,
            body,
            url: '/studio/revenue',
          },
        })
      }
      if (artist.notifyMoneyMovesEmail && artist.emailVerifiedAt) {
        await sendWorkerMail({
          to: artist.email,
          subject: `Tahti · ${title}`,
          text: `${title}\n${body}.\n\n${APP_URL}/studio/revenue\n\nYou can turn these emails off in Settings → Notifications.`,
        })
      }
      announced++
    } catch (err) {
      console.error(`[fan-sub-payout] payout notice failed for ${row.artistUserId}:`, err)
    }
  }
  return { announced }
}
