// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

// M15 — @handle mention parser and notification writer.
// Parses @username tokens from free text and records Mention rows for targets
// who have mentionsEnabled and haven't muted the mentioner.

import type { PrismaClient, MentionSurface } from '@tahti/db'

const HANDLE_RE = /@([a-z0-9_-]{2,32})/gi
const DAILY_MENTION_LIMIT = 20

export function extractHandles(text: string): string[] {
  const handles: string[] = []
  let m: RegExpExecArray | null
  HANDLE_RE.lastIndex = 0
  while ((m = HANDLE_RE.exec(text)) !== null) {
    handles.push(m[1].toLowerCase())
  }
  return [...new Set(handles)]
}

export async function recordMentions(
  prisma: PrismaClient,
  mentionerUserId: string,
  text: string,
  surface: MentionSurface,
  sourceId: string,
): Promise<void> {
  const handles = extractHandles(text)
  if (handles.length === 0) return

  // Enforce daily limit per mentioner
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000)
  const todayCount = await prisma.mention.count({
    where: { mentionerUserId, createdAt: { gte: dayAgo } },
  })
  const remaining = Math.max(0, DAILY_MENTION_LIMIT - todayCount)
  if (remaining === 0) return

  const slice = handles.slice(0, remaining)

  // Resolve handles to user IDs; skip unknown handles, self-mentions, and mutes
  const targets = await prisma.user.findMany({
    where: {
      username: { in: slice, mode: 'insensitive' },
      mentionsEnabled: true,
      id: { not: mentionerUserId },
      mentionsMutedBy: { none: { muterId: mentionerUserId } },
    },
    select: { id: true },
  })

  if (targets.length === 0) return

  await prisma.mention.createMany({
    data: targets.map((t) => ({
      mentionerUserId,
      targetUserId: t.id,
      surface,
      sourceId,
    })),
    skipDuplicates: true,
  })
}
