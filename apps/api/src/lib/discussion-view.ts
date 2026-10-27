// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Prisma } from '@tahti/db'
import type { DiscussionTopicView } from '@tahti/shared'
import { userName } from './safe-names.js'

export const DISCUSSION_TOPIC_SELECT = {
  id: true,
  title: true,
  body: true,
  status: true,
  pinned: true,
  lastPostAt: true,
  createdAt: true,
  createdBy: { select: { username: true, displayName: true } },
  _count: { select: { posts: true } },
} satisfies Prisma.DiscussionTopicSelect

type TopicRow = Prisma.DiscussionTopicGetPayload<{ select: typeof DISCUSSION_TOPIC_SELECT }>

export function toDiscussionTopicView(row: TopicRow): DiscussionTopicView {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    status: row.status,
    pinned: row.pinned,
    createdBy: userName(row.createdBy),
    postCount: row._count.posts,
    lastPostAt: row.lastPostAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}
