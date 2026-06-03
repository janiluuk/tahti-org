// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { postAnnouncement, deleteAnnouncement } from './actions'

interface Announcement {
  id: string
  body: string
  createdAt: string
}

export default function AnnouncementsPanel({ initial }: { initial: Announcement[] }) {
  const [announcements, setAnnouncements] = useState(initial)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePost() {
    const text = draft.trim()
    if (!text) return
    setPosting(true)
    setError(null)
    const result = await postAnnouncement(text)
    if (result.error) {
      setError(result.error)
    } else {
      const now = new Date().toISOString()
      const newAnn: Announcement = { id: result.id!, body: text, createdAt: now }
      setAnnouncements((prev) => {
        const updated = [newAnn, ...prev]
        return updated.slice(0, 3)
      })
      setDraft('')
    }
    setPosting(false)
  }

  async function handleDelete(id: string) {
    const result = await deleteAnnouncement(id)
    if (!result.error) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    }
  }

  return (
    <div
      style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}
    >
      <h2 style={{ margin: '0 0 1rem' }}>Pinned announcements</h2>
      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#666' }}>
        Up to 3 pinned messages shown above the chat on your channel page.
      </p>

      {announcements.length === 0 && (
        <p style={{ color: '#aaa', fontSize: '0.875rem', marginBottom: '1rem' }}>
          No announcements yet.
        </p>
      )}

      {announcements.map((a) => (
        <div
          key={a.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '0.6rem 0.75rem',
            marginBottom: '0.5rem',
            background: '#fffbeb',
            borderLeft: '3px solid #f59e0b',
            borderRadius: 4,
          }}
        >
          <span style={{ flex: 1, fontSize: '0.875rem' }}>{a.body}</span>
          <button
            onClick={() => void handleDelete(a.id)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#aaa',
              fontSize: '1rem',
              lineHeight: 1,
              padding: '0 0.2rem',
              flexShrink: 0,
            }}
            aria-label="Delete announcement"
          >
            ×
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) void handlePost()
          }}
          placeholder="Type an announcement…"
          maxLength={500}
          disabled={posting || announcements.length >= 3}
          style={{
            flex: 1,
            padding: '0.4rem 0.6rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            fontSize: '0.875rem',
          }}
        />
        <button
          onClick={() => void handlePost()}
          disabled={posting || !draft.trim() || announcements.length >= 3}
          style={{
            padding: '0.4rem 0.9rem',
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '0.875rem',
            opacity: posting || !draft.trim() || announcements.length >= 3 ? 0.5 : 1,
          }}
        >
          {posting ? 'Posting…' : 'Pin'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>
      )}
      {announcements.length >= 3 && (
        <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Remove one to add another (max 3).
        </p>
      )}
    </div>
  )
}
