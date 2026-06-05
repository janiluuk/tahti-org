// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export type BounceKind = 'hard' | 'soft' | 'complaint'

export type ParsedBounce = {
  email: string
  kind: BounceKind
}

export type SnsSubscriptionConfirm = {
  subscribeUrl: string
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Returns true when the address should be removed from future sends. */
export function shouldUnsubscribeForBounce(kind: BounceKind): boolean {
  return kind === 'hard' || kind === 'complaint'
}

/**
 * Parse Postmark bounce/complaint payloads, AWS SNS notifications, or a simple
 * `{ email, type }` test hook.
 */
export function parseEmailBouncePayload(
  body: unknown,
): ParsedBounce | SnsSubscriptionConfirm | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>

  if (o.Type === 'SubscriptionConfirmation' && typeof o.SubscribeURL === 'string') {
    return { subscribeUrl: o.SubscribeURL }
  }

  if (o.RecordType === 'Bounce' && typeof o.Email === 'string') {
    const type = String(o.Type ?? '')
    const kind: BounceKind = type === 'SoftBounce' ? 'soft' : 'hard'
    return { email: o.Email, kind }
  }

  if (o.RecordType === 'SpamComplaint' && typeof o.Email === 'string') {
    return { email: o.Email, kind: 'complaint' }
  }

  if (o.Type === 'Notification' && typeof o.Message === 'string') {
    try {
      const msg = JSON.parse(o.Message) as Record<string, unknown>
      if (msg.notificationType === 'Bounce') {
        const bounce = msg.bounce as {
          bounceType?: string
          bouncedRecipients?: { emailAddress?: string }[]
        }
        const email = bounce?.bouncedRecipients?.[0]?.emailAddress
        if (!email) return null
        const kind: BounceKind = bounce?.bounceType === 'Transient' ? 'soft' : 'hard'
        return { email, kind }
      }
      if (msg.notificationType === 'Complaint') {
        const complaint = msg.complaint as {
          complainedRecipients?: { emailAddress?: string }[]
        }
        const email = complaint?.complainedRecipients?.[0]?.emailAddress
        if (!email) return null
        return { email, kind: 'complaint' }
      }
    } catch {
      return null
    }
  }

  if (typeof o.email === 'string') {
    const raw = String(o.type ?? o.kind ?? 'hard').toLowerCase()
    const kind: BounceKind =
      raw === 'soft' || raw === 'softbounce' ? 'soft' : raw === 'complaint' ? 'complaint' : 'hard'
    return { email: o.email, kind }
  }

  return null
}

/** Hard bounces and spam complaints auto-unsubscribe and mark pending/sent rows. */
export async function recordNewsletterBounce(
  prisma: PrismaClient,
  email: string,
): Promise<{ unsubscribed: number; sendsMarked: number }> {
  const normalized = normalizeEmail(email)
  const subs = await prisma.newsletterSubscriber.findMany({
    where: {
      email: { equals: normalized, mode: 'insensitive' },
      unsubscribedAt: null,
    },
    select: { id: true },
  })

  if (subs.length === 0) return { unsubscribed: 0, sendsMarked: 0 }

  const now = new Date()
  const ids = subs.map((s) => s.id)

  await prisma.newsletterSubscriber.updateMany({
    where: { id: { in: ids } },
    data: { unsubscribedAt: now },
  })

  const sends = await prisma.newsletterSend.updateMany({
    where: {
      subscriberId: { in: ids },
      bouncedAt: null,
      state: { in: ['QUEUED', 'SENT'] },
    },
    data: { bouncedAt: now, state: 'BOUNCED' },
  })

  return { unsubscribed: subs.length, sendsMarked: sends.count }
}
