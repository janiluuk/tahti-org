'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import type { FeedItem } from '@tahti/shared'
import { Button } from '@tahti/ui'
import { useToast } from '@/contexts/toast-context'
import { deleteFeedPost, updateFeedPost } from './_feed-actions'
import { formatFullDate } from './_feed-format'

type PostFeedItem = Extract<FeedItem, { kind: 'post' }>

function datetimeLocalToIso(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  d.setSeconds(0, 0)
  const tzOffsetMs = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16)
}

/** Editing a post is a genuinely different concern from viewing one (a
 * form, not more content to disclose) — kept as a small dedicated modal
 * while viewing moved to FeedCard's inline Reveal. Only ever opened for
 * the viewer's own post. */
export function FeedPostEditModal({
  item,
  onClose,
  onDeleted,
  onUpdated,
}: {
  item: PostFeedItem
  onClose: () => void
  onDeleted: (id: string) => void
  onUpdated: (item: FeedItem) => void
}) {
  const { showToast } = useToast()

  const [title, setTitle] = useState(item.title ?? '')
  const [body, setBody] = useState(item.body)
  const [linkUrl, setLinkUrl] = useState(item.linkUrl ?? '')
  const [linkLabel, setLinkLabel] = useState(item.linkLabel ?? '')
  const [scheduleAt, setScheduleAt] = useState(isoToDatetimeLocal(item.date))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function saveEdits() {
    if (!body.trim()) {
      setError('Write something first.')
      return
    }
    const trimmedLink = linkUrl.trim()
    if (trimmedLink) {
      try {
        new URL(trimmedLink)
      } catch {
        setError('Link must be a valid URL (e.g. https://example.com).')
        return
      }
    }
    const publishAtIso = datetimeLocalToIso(scheduleAt)
    setPending(true)
    setError(null)
    const res = await updateFeedPost(item.id, {
      title: title.trim() || null,
      body: body.trim(),
      linkUrl: trimmedLink || null,
      linkLabel: linkLabel.trim() || null,
      ...(publishAtIso ? { publishAt: publishAtIso } : {}),
    })
    setPending(false)
    if (res.error || !res.post) {
      setError(res.error ?? 'Failed to save changes')
      showToast(res.error ?? 'Failed to save changes', 'error')
      return
    }

    const isFuture = new Date(res.post.publishAt).getTime() > Date.now()
    if (isFuture) {
      showToast(`Rescheduled for ${formatFullDate(res.post.publishAt)}`, 'success')
      onDeleted(item.id)
      onClose()
      return
    }

    showToast('Post updated', 'success')
    onUpdated({
      ...item,
      title: res.post.title,
      body: res.post.body,
      linkUrl: res.post.linkUrl,
      linkLabel: res.post.linkLabel,
      date: res.post.publishAt,
    })
    onClose()
  }

  async function remove() {
    setPending(true)
    const res = await deleteFeedPost(item.id)
    setPending(false)
    if (res.error) {
      showToast(res.error, 'error')
      return
    }
    showToast('Post deleted', 'success')
    onDeleted(item.id)
    onClose()
  }

  return (
    <div
      className="feed-post-modal__overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="feed-post-modal" role="dialog" aria-modal="true" aria-label="Edit post">
        <button
          type="button"
          className="feed-post-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <div className="feed-post-modal__body">
          <div className="feed-post-modal__editor">
            <label className="studio-field">
              <span className="studio-label">Title (optional)</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="studio-input"
                disabled={pending}
              />
            </label>
            <label className="studio-field studio-mt-sm">
              <span className="studio-label">Post</span>
              <textarea
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="studio-input"
                disabled={pending}
              />
            </label>
            <label className="studio-field studio-mt-sm">
              <span className="studio-label">Link (optional)</span>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="studio-input"
                disabled={pending}
                placeholder="https://…"
              />
            </label>
            {linkUrl.trim() && (
              <label className="studio-field studio-mt-sm">
                <span className="studio-label">Link label (optional)</span>
                <input
                  type="text"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  className="studio-input"
                  disabled={pending}
                />
              </label>
            )}
            <label className="studio-field studio-mt-sm">
              <span className="studio-label">Publish at</span>
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="studio-input"
                disabled={pending}
              />
              <span className="studio-text-muted-sm studio-mt-xs">
                Set a future time to reschedule instead of saving now.
              </span>
            </label>
            {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
            <div className="feed-post-modal__actions studio-mt-sm">
              <Button
                onClick={() => void saveEdits()}
                disabled={pending}
                variant="primary"
                size="sm"
              >
                {pending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                onClick={() => void remove()}
                disabled={pending}
                variant="ghost"
                size="sm"
                className="studio-text-error"
              >
                {pending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
