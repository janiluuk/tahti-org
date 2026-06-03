// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { isActiveFanSubscriber } from './fansub.js'

/** Structured perk codes artists add to tier bullet lists (see dashboard copy). */
export const FAN_PERK_FAN_CHAT = 'FAN_CHAT'
export const FAN_PERK_FAN_NEWSLETTER = 'FAN_NEWSLETTER'

export async function artistOffersFanChat(prisma: PrismaClient, artistUserId: string) {
  const tier = await prisma.fanTier.findFirst({
    where: { artistUserId, active: true, perks: { has: FAN_PERK_FAN_CHAT } },
    select: { id: true },
  })
  return !!tier
}

export async function artistOffersFanNewsletter(prisma: PrismaClient, artistUserId: string) {
  const tier = await prisma.fanTier.findFirst({
    where: { artistUserId, active: true, perks: { has: FAN_PERK_FAN_NEWSLETTER } },
    select: { id: true },
  })
  return !!tier
}

export async function subscriberHasFanChat(
  prisma: PrismaClient,
  artistUserId: string,
  subscriberUserId: string,
) {
  if (!(await artistOffersFanChat(prisma, artistUserId))) return false
  return isActiveFanSubscriber(prisma, artistUserId, subscriberUserId)
}

export async function subscriberHasFanNewsletter(
  prisma: PrismaClient,
  artistUserId: string,
  subscriberUserId: string,
) {
  if (!(await artistOffersFanNewsletter(prisma, artistUserId))) return false
  return isActiveFanSubscriber(prisma, artistUserId, subscriberUserId)
}

/** Confirmed newsletter rows whose email matches an active fan subscriber account. */
export async function fanOnlyNewsletterSubscriberIds(prisma: PrismaClient, artistUserId: string) {
  if (!(await artistOffersFanNewsletter(prisma, artistUserId))) return []

  const subs = await prisma.fanSubscription.findMany({
    where: { artistUserId },
    select: { subscriberUserId: true },
  })

  const fanEmails = new Set<string>()
  for (const s of subs) {
    if (!(await subscriberHasFanNewsletter(prisma, artistUserId, s.subscriberUserId))) continue
    const user = await prisma.user.findUnique({
      where: { id: s.subscriberUserId },
      select: { email: true },
    })
    if (user?.email) fanEmails.add(user.email.toLowerCase())
  }
  if (fanEmails.size === 0) return []

  const rows = await prisma.newsletterSubscriber.findMany({
    where: {
      artistUserId,
      confirmedAt: { not: null },
      unsubscribedAt: null,
    },
    select: { id: true, email: true },
  })

  return rows.filter((r) => fanEmails.has(r.email.toLowerCase())).map((r) => r.id)
}
