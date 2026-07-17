// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export interface CommentItem {
  id: string
  body: string
  authorUsername: string
  authorDisplayName: string
  authorAvatarUrl: string | null
  createdAt: string
}

function timeAgo(iso: string): string {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export function CommentsSection({
  target,
  isLoggedIn,
  initialComments,
  initialCommentsEnabled,
}: {
  target: { type: 'track'; id: string } | { type: 'channel'; slug: string }
  isLoggedIn: boolean
  initialComments: CommentItem[]
  initialCommentsEnabled: boolean
}) {
  const [comments, setComments] = useState(initialComments)
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const postUrl =
    target.type === 'track'
      ? `${API_BASE}/api/comments/track/${target.id}`
      : `${API_BASE}/api/comments/channel/${target.slug}`

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch(postUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Could not post comment')
        return
      }
      const comment = (await res.json()) as CommentItem
      setComments((prev) => [...prev, comment])
      setBody('')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="comments-section">
      {comments.length === 0 ? (
        <p className="comments-section__empty">No comments yet.</p>
      ) : (
        <ul className="comments-section__list">
          {comments.map((c) => (
            <li key={c.id} className="comments-section__item">
              <span className="comments-section__author">{c.authorDisplayName}</span>
              <span className="comments-section__time">{timeAgo(c.createdAt)}</span>
              <p className="comments-section__body">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      {!initialCommentsEnabled ? (
        <p className="comments-section__disabled">Comments are off.</p>
      ) : isLoggedIn ? (
        <div className="comments-section__form">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            maxLength={2000}
            rows={2}
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={pending || !body.trim()}
            className="comments-section__submit"
          >
            {pending ? 'Posting…' : 'Post'}
          </button>
          {error && <p className="comments-section__error">{error}</p>}
        </div>
      ) : (
        <p className="comments-section__login-hint">
          <a href="/login">Log in</a> to comment.
        </p>
      )}
    </div>
  )
}
