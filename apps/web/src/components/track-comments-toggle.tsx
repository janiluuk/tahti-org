// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { CommentsSection, type CommentItem } from './comments-section'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

/** Comments are fetched lazily on expand — a channel page can list dozens of tracks. */
export function TrackCommentsToggle({
  archiveItemId,
  isLoggedIn,
}: {
  archiveItemId: string
  isLoggedIn: boolean
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState<CommentItem[] | null>(null)
  const [commentsEnabled, setCommentsEnabled] = useState(true)

  async function expand() {
    setOpen(true)
    if (comments !== null) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/comments/track/${archiveItemId}`)
      if (res.ok) {
        const data = (await res.json()) as { comments: CommentItem[]; commentsEnabled: boolean }
        setComments(data.comments)
        setCommentsEnabled(data.commentsEnabled)
      } else {
        setComments([])
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="track-comments-toggle" onClick={() => void expand()}>
        Comments
      </button>
    )
  }

  return (
    <div className="track-comments-toggle__panel">
      <button
        type="button"
        className="track-comments-toggle track-comments-toggle--open"
        onClick={() => setOpen(false)}
      >
        Comments
      </button>
      {loading || comments === null ? (
        <p className="comments-section__empty">Loading…</p>
      ) : (
        <CommentsSection
          target={{ type: 'track', id: archiveItemId }}
          isLoggedIn={isLoggedIn}
          initialComments={comments}
          initialCommentsEnabled={commentsEnabled}
        />
      )}
    </div>
  )
}
