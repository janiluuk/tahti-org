// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { sendGovernanceMeetingNoticeEmail } from './email.js'

/**
 * Sends the meeting-notice email to every current member and records one
 * GovernanceNoticeDelivery row per recipient (sentAt now, bouncedAt filled
 * in later by the email-bounce webhook). Best-effort per recipient — one
 * failed send does not block the rest. Returns how many were recorded.
 */
export async function sendMeetingNoticeAndRecordDeliveries(
  prisma: PrismaClient,
  meeting: {
    id: string
    title: string
    type: string
    scheduledAt: Date | null
    location: string | null
    remoteUrl: string | null
  },
): Promise<number> {
  const recipients = await prisma.user.findMany({
    where: { isMember: true },
    select: { id: true, email: true, displayName: true },
  })

  let recorded = 0
  for (const recipient of recipients) {
    if (!recipient.email) continue
    try {
      await sendGovernanceMeetingNoticeEmail({
        to: recipient.email,
        displayName: recipient.displayName,
        meetingTitle: meeting.title,
        meetingType: meeting.type,
        scheduledAt: meeting.scheduledAt,
        location: meeting.location,
        remoteUrl: meeting.remoteUrl,
      })
      await prisma.governanceNoticeDelivery.upsert({
        where: { meetingId_memberId: { meetingId: meeting.id, memberId: recipient.id } },
        create: { meetingId: meeting.id, memberId: recipient.id, email: recipient.email },
        update: { email: recipient.email, sentAt: new Date() },
      })
      recorded++
    } catch (err: unknown) {
      // A bad address or SMTP hiccup for one member must not block the rest
      // of the run, or a resolved bounce from a previous webhook call.
      console.error('[governance-notice] failed to send/record for', recipient.id, err)
    }
  }
  return recorded
}

/**
 * Marks any not-yet-bounced GovernanceNoticeDelivery rows for this address as
 * bounced. Called from the shared email-bounce webhook alongside the
 * newsletter-specific handling — unlike that path, this isn't gated by
 * shouldUnsubscribeForBounce: a soft bounce is still real evidence the
 * notice may not have landed, which is the whole point of tracking this.
 */
export async function recordGovernanceNoticeBounce(
  prisma: PrismaClient,
  email: string,
): Promise<{ marked: number }> {
  const result = await prisma.governanceNoticeDelivery.updateMany({
    where: { email: { equals: email, mode: 'insensitive' }, bouncedAt: null },
    data: { bouncedAt: new Date() },
  })
  return { marked: result.count }
}
