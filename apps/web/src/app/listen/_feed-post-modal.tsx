// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { FeedItem } from '@tahti/shared'
import { Button, ButtonIcon } from '@tahti/ui'
import { useToast } from '@/contexts/toast-context'
import { deleteFeedPost, updateFeedPost } from './_feed-actions'
import { feedCover, feedHeadline, formatFullDate } from './_feed-format'

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

export function FeedPostModal({
  item,
  viewerUsername,
  onClose,
  onDeleted,
  onUpdated,
}: {
  item: FeedItem
  viewerUsername: string | null
  onClose: () => void
  onDeleted: (id: string) => void
  onUpdated: (item: FeedItem) => void
}) {
  const { showToast } = useToast()
  const isOwnerPost = item.kind === 'post' && viewerUsername === item.artist.username

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.kind === 'post' ? (item.title ?? '') : '')
  const [body, setBody] = useState(item.kind === 'post' ? item.body : '')
  const [linkUrl, setLinkUrl] = useState(item.kind === 'post' ? (item.linkUrl ?? '') : '')
  const [linkLabel, setLinkLabel] = useState(item.kind === 'post' ? (item.linkLabel ?? '') : '')
  const [scheduleAt, setScheduleAt] = useState(
    item.kind === 'post' ? isoToDatetimeLocal(item.date) : '',
  )
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
    if (item.kind !== 'post') return
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
    } as FeedItem)
    setEditing(false)
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

  const cover = feedCover(item)
  const headline = feedHeadline(item)

  return (
    <div
      className="feed-post-modal__overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="feed-post-modal" role="dialog" aria-modal="true" aria-label={headline}>
        <button
          type="button"
          className="feed-post-modal__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="feed-post-modal__cover" />
        )}

        <div className="feed-post-modal__body">
          <div className="feed-post-modal__byline">
            <Link href={`/u/${item.artist.username}`} className="feed-post-modal__artist">
              {item.artist.displayName}
            </Link>
            <span className="feed-post-modal__date">{formatFullDate(item.date)}</span>
          </div>

          {editing ? (
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
                  onClick={() => setEditing(false)}
                  disabled={pending}
                  variant="ghost"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              {item.kind === 'post' && item.title && (
                <h2 className="feed-post-modal__title">{item.title}</h2>
              )}
              {item.kind !== 'post' && <h2 className="feed-post-modal__title">{headline}</h2>}
              {item.kind === 'post' ? (
                <p className="feed-post-modal__text">{item.body}</p>
              ) : (
                <p className="feed-post-modal__text">
                  <Link href={item.url}>
                    {item.kind === 'release' ? 'View release →' : 'Listen →'}
                  </Link>
                </p>
              )}
              {item.kind === 'post' && item.linkUrl && (
                <a
                  href={item.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="feed-post-modal__link"
                >
                  {item.linkLabel || item.linkUrl}
                </a>
              )}
              {item.kind === 'post' && item.images.length > 1 && (
                <div className="feed-post-modal__images">
                  {item.images.slice(1).map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" />
                  ))}
                </div>
              )}

              {isOwnerPost && (
                <div className="feed-post-modal__actions studio-mt-md">
                  <Button onClick={() => setEditing(true)} variant="secondary" size="sm">
                    <ButtonIcon name="edit" />
                    Edit
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
