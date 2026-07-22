// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { CommentsSection, type CommentItem } from './comments-section'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

function IconComment() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.5 3.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6l-3 3v-3H2.5a1 1 0 0 1-1-1z"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Comments are fetched lazily on expand — a channel page can list dozens of tracks. */
export function TrackCommentsToggle({
  archiveItemId,
  isLoggedIn,
  commentCount = 0,
}: {
  archiveItemId: string
  isLoggedIn: boolean
  commentCount?: number
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
      <button
        type="button"
        className="track-comments-toggle"
        onClick={() => void expand()}
        aria-label={`${commentCount} comment${commentCount === 1 ? '' : 's'}`}
        title="Comments"
      >
        <IconComment />
        {commentCount}
      </button>
    )
  }

  return (
    <div className="track-comments-toggle__panel">
      <button
        type="button"
        className="track-comments-toggle track-comments-toggle--open"
        onClick={() => setOpen(false)}
        title="Comments"
      >
        <IconComment />
        {commentCount}
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
