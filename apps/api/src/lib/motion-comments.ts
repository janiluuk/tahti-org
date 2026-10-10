// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { userName } from './safe-names.js'

type MotionCommentRow = {
  id: bigint
  body: string
  authorId: string | null
  author: { username: string; displayName: string } | null
  createdAt: Date
  removedAt: Date | null
}

/** A motion comment as the API sends it. A removed comment keeps its place,
 * author and time, but its text is never served again. */
export function motionCommentView(c: MotionCommentRow) {
  return {
    id: c.id.toString(),
    body: c.removedAt ? '' : c.body,
    authorId: c.authorId,
    authorDisplayName: c.author ? userName(c.author) : null,
    createdAt: c.createdAt,
    removed: c.removedAt !== null,
  }
}
