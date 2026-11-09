// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { config } from '../config.js'
import { enqueueSocialPostDispatch } from './social-post.js'

type ShareTarget = 'MASTODON' | 'BLUESKY'

export function eventSocialMessage(event: {
  id: string
  title: string
  place: string
  location: string
  startAt: Date
}): string {
  const day = event.startAt.toISOString().slice(0, 10)
  return `${event.title} — ${day}, ${event.place}, ${event.location}\n${config.appUrl}/events/${event.id}`
}

// Posts a published event to the artist's connected Mastodon / Bluesky accounts
// the artist picked. Platforms that are not connected are skipped.
export async function queueEventSocialPosts(
  prisma: PrismaClient,
  userId: string,
  event: { id: string; title: string; place: string; location: string; startAt: Date },
  targets: ShareTarget[],
): Promise<ShareTarget[]> {
  if (targets.length === 0) return []
  const conns = await prisma.socialConnection.findMany({
    where: { userId, platform: { in: targets } },
    select: { platform: true },
  })
  const queued: ShareTarget[] = []
  for (const conn of conns) {
    const post = await prisma.socialPost.create({
      data: {
        userId,
        platform: conn.platform,
        trigger: 'event_published',
        eventId: event.id,
        message: eventSocialMessage(event),
      },
    })
    await enqueueSocialPostDispatch(post.id)
    queued.push(conn.platform as ShareTarget)
  }
  return queued
}
