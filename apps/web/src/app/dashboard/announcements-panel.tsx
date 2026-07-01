// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Panel } from '@tahti/ui'
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
    if (!confirm('Delete this announcement?')) return
    const result = await deleteAnnouncement(id)
    if (result.error) {
      setError(result.error)
    } else {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
    }
  }

  return (
    <Panel
      title="Pinned announcements"
      headerTight
      description="Up to 3 pinned messages shown above the chat on your channel page."
      className="studio-mt-lg"
    >
      {announcements.length === 0 && <p className="studio-empty">No announcements yet.</p>}

      {announcements.map((a) => (
        <div key={a.id} className="studio-announce-item">
          <span className="studio-announce-item__body">{a.body}</span>
          <button
            onClick={() => void handleDelete(a.id)}
            className="ui-btn ui-btn--sm ui-btn--ghost"
            aria-label="Delete announcement"
          >
            ×
          </button>
        </div>
      ))}

      <div className="studio-input-row">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) void handlePost()
          }}
          placeholder="Type an announcement…"
          maxLength={500}
          disabled={posting || announcements.length >= 3}
          className="studio-input studio-flex-1"
        />
        <button
          onClick={() => void handlePost()}
          disabled={posting || !draft.trim() || announcements.length >= 3}
          className="ui-btn ui-btn--primary"
        >
          {posting ? 'Posting…' : 'Pin'}
        </button>
      </div>

      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
      {announcements.length >= 3 && (
        <p className="studio-text-muted-sm studio-mt-sm">Remove one to add another (max 3).</p>
      )}
    </Panel>
  )
}
