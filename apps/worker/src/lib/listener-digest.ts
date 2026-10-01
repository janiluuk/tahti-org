// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { APP_URL, sendWorkerMail } from './mailer.js'

const DAY_MS = 24 * 60 * 60 * 1000

export interface ListenerDigestCounts {
  chatMessages: number
  comments: number
  broadcastReactions: number
}

function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en')} ${n === 1 ? one : many}`
}

export function listenerDigestText(displayName: string, n: ListenerDigestCounts): string {
  const lines = [
    n.chatMessages > 0
      ? `• ${plural(n.chatMessages, 'new chat message', 'new chat messages')}`
      : null,
    n.comments > 0 ? `• ${plural(n.comments, 'new comment', 'new comments')}` : null,
    n.broadcastReactions > 0
      ? `• ${plural(n.broadcastReactions, 'reaction', 'reactions')} during your broadcasts`
      : null,
  ].filter((line): line is string => line !== null)
  return [
    `Hi ${displayName},`,
    '',
    'Your listeners in the last day:',
    '',
    ...lines,
    '',
    `Open Tahti: ${APP_URL}/studio`,
    '',
    'You can turn this email off in Settings → Notifications.',
    '',
    '— Tahti',
  ].join('\n')
}

/** Daily email to each artist who wants it ("Listener actions" in Settings →
 * Notifications): chat messages from other people in their channel, comments
 * on their tracks and channel, and reactions during their broadcasts, over the
 * last 24 hours. Nothing is sent on a quiet day. */
export async function processListenerDigests(prisma: PrismaClient, now: Date = new Date()) {
  const since = new Date(now.getTime() - DAY_MS)
  const artists = await prisma.user.findMany({
    where: {
      notifyListenerActivityEmail: true,
      emailVerifiedAt: { not: null },
      deletedAt: null,
      suspendedAt: null,
      channel: { isNot: null },
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      channel: { select: { id: true } },
    },
  })

  let sent = 0
  let quiet = 0
  let failed = 0
  for (const artist of artists) {
    if (!artist.channel) continue
    const channelId = artist.channel.id
    const [chatMessages, comments, broadcastReactions] = await Promise.all([
      prisma.chatMessage.count({
        where: {
          channelId,
          createdAt: { gte: since },
          OR: [{ userId: null }, { userId: { not: artist.id } }],
        },
      }),
      prisma.comment.count({
        where: {
          createdAt: { gte: since },
          authorId: { not: artist.id },
          OR: [{ channelId }, { sound: { channelId } }],
        },
      }),
      prisma.broadcastReaction.count({
        where: { createdAt: { gte: since }, broadcast: { channelId } },
      }),
    ])
    const counts = { chatMessages, comments, broadcastReactions }
    const total = chatMessages + comments + broadcastReactions
    if (total === 0) {
      quiet++
      continue
    }
    try {
      await sendWorkerMail({
        to: artist.email,
        subject: `Tahti · ${plural(total, 'new listener action', 'new listener actions')}`,
        text: listenerDigestText(artist.displayName || artist.username, counts),
      })
      sent++
    } catch (err) {
      failed++
      console.error(`[listener-digest] failed to send to ${artist.id}:`, err)
    }
  }
  return { sent, quiet, failed }
}
