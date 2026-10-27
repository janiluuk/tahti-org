// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { availableUserWhere, type PrismaClient } from '@tahti/db'

const OUTCOME_TITLES = {
  APPROVED: (name: string) => `${name} was approved and is in the add-on store`,
  REJECTED: (name: string) => `${name} was not approved`,
  DISABLED: (name: string) => `The board disabled ${name}`,
} as const

/** Tells an add-on's author what the board decided in Admin → Add-ons, with
 * the board's note. Add-ons without a Tahti account as author (imported
 * from the registry) get nothing. Never throws — the decision is saved. */
export async function notifyAuthorOfAddonReview(
  prisma: PrismaClient,
  addon: { name: string; authorUserId: string | null },
  outcome: keyof typeof OUTCOME_TITLES,
  note: string | null,
  log: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  if (!addon.authorUserId) return
  try {
    const author = await prisma.user.findFirst({
      where: { id: addon.authorUserId, ...availableUserWhere },
      select: { id: true },
    })
    if (!author) return
    await prisma.notification.create({
      data: {
        userId: author.id,
        type: 'ADDON_REVIEWED',
        title: OUTCOME_TITLES[outcome](addon.name),
        body: note?.trim().slice(0, 500) || null,
        url: '/settings/plugin-store',
      },
    })
  } catch (err) {
    log.warn({ err }, 'add-on review notice failed')
  }
}
