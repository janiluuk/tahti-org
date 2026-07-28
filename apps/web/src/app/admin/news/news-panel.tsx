// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@tahti/ui'
import { createNewsPost, deleteNewsPost, updateNewsPost } from './actions'

export interface AdminNewsPostRow {
  id: string
  headline: string
  summary: string
  authorName: string
  publishedAt: string | null
  createdAt: string
}

function ComposeForm() {
  const router = useRouter()
  const [headline, setHeadline] = useState('')
  const [summary, setSummary] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(publish: boolean) {
    if (!headline.trim() || !summary.trim()) {
      setError('Headline and summary are both required')
      return
    }
    setPending(true)
    setError(null)
    const res = await createNewsPost({
      headline: headline.trim(),
      summary: summary.trim(),
      publish,
    })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setHeadline('')
    setSummary('')
    router.refresh()
  }

  return (
    <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
      <h2>Write a news post</h2>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <label>
          Headline
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            maxLength={200}
            disabled={pending}
            className="admin-input"
          />
        </label>
        <label>
          Short summary
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={pending}
            className="admin-input"
          />
        </label>
        {error && <p className="admin-form-error">{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="primary" disabled={pending} onClick={() => void submit(true)}>
            Publish
          </Button>
          <Button variant="secondary" disabled={pending} onClick={() => void submit(false)}>
            Save as draft
          </Button>
        </div>
      </div>
    </section>
  )
}

function PostRow({ post }: { post: AdminNewsPostRow }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [headline, setHeadline] = useState(post.headline)
  const [summary, setSummary] = useState(post.summary)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveEdits() {
    setPending(true)
    setError(null)
    const res = await updateNewsPost(post.id, {
      headline: headline.trim(),
      summary: summary.trim(),
    })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setEditing(false)
    router.refresh()
  }

  async function togglePublish() {
    setPending(true)
    setError(null)
    const res = await updateNewsPost(post.id, { publish: !post.publishedAt })
    setPending(false)
    if (res.error) setError(res.error)
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete "${post.headline}"? This can't be undone.`)) return
    setPending(true)
    setError(null)
    const res = await deleteNewsPost(post.id)
    setPending(false)
    if (res.error) setError(res.error)
    router.refresh()
  }

  return (
    <li className="admin-card" style={{ marginBottom: '0.75rem' }}>
      {editing ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label>
            Headline
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={200}
              disabled={pending}
              className="admin-input"
            />
          </label>
          <label>
            Short summary
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={pending}
              className="admin-input"
            />
          </label>
          {error && <p className="admin-form-error">{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="primary" disabled={pending} onClick={() => void saveEdits()}>
              Save
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <strong>{post.headline}</strong>
              <p className="admin-stat-sub" style={{ margin: '0.25rem 0' }}>
                By {post.authorName} ·{' '}
                {post.publishedAt
                  ? `Published ${new Date(post.publishedAt).toLocaleDateString()}`
                  : 'Draft'}
              </p>
              <p style={{ margin: 0 }}>{post.summary}</p>
            </div>
          </div>
          {error && <p className="admin-form-error">{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              className="admin-btn admin-btn--sm"
              disabled={pending}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              className="admin-btn admin-btn--sm"
              disabled={pending}
              onClick={() => void togglePublish()}
            >
              {post.publishedAt ? 'Unpublish' : 'Publish'}
            </button>
            <button
              className="admin-btn admin-btn--sm admin-btn--danger"
              disabled={pending}
              onClick={() => void remove()}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  )
}

export function NewsPanel({ posts }: { posts: AdminNewsPostRow[] }) {
  return (
    <>
      <ComposeForm />
      {posts.length === 0 ? (
        <p className="admin-text-muted">No news posts yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {posts.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </ul>
      )}
    </>
  )
}
