// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ButtonIcon, Button, Panel } from '@tahti/ui'
import type { ArtistPostView } from '@tahti/shared'
import { completePostImageUpload, createPost, deletePost, preparePostImageUpload } from './actions'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGES = 10

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// <input type="datetime-local"> has no timezone info; interpret it in the
// browser's local timezone, same as the user picked it.
function datetimeLocalToIso(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function minDatetimeLocal(): string {
  const d = new Date(Date.now() + 60_000)
  d.setSeconds(0, 0)
  return d.toISOString().slice(0, 16)
}

export function PostsManager({ initialPosts }: { initialPosts: ArtistPostView[] }) {
  const [posts, setPosts] = useState(initialPosts)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleAt, setScheduleAt] = useState('')
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function publish() {
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
    let publishAt: string | undefined
    if (scheduleEnabled) {
      publishAt = datetimeLocalToIso(scheduleAt)
      if (!publishAt) {
        setError('Pick a date and time to schedule for.')
        return
      }
      if (new Date(publishAt).getTime() <= Date.now()) {
        setError('Scheduled time must be in the future.')
        return
      }
    }
    setPending(true)
    setError(null)
    setStatus(publishAt ? 'Scheduling…' : 'Publishing…')

    const created = await createPost({
      title: title.trim() || undefined,
      body: body.trim(),
      linkUrl: trimmedLink || undefined,
      linkLabel: linkLabel.trim() || undefined,
      publishAt,
    })
    if (created.error || !created.post) {
      setPending(false)
      setError(created.error ?? 'Failed to publish post')
      setStatus(null)
      return
    }

    let finalPost = created.post
    const postId = created.post.id

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      setStatus(`Uploading image ${i + 1} of ${files.length}…`)

      const prep = await preparePostImageUpload(postId, file.name, file.type)
      if (prep.error || !prep.uploadUrl || !prep.uploadKey) continue

      const putRes = await fetch(prep.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!putRes.ok) continue

      const complete = await completePostImageUpload(postId, prep.uploadKey)
      if (complete.post) finalPost = complete.post
    }

    setPosts((prev) => [finalPost, ...prev].sort((a, b) => (a.publishAt < b.publishAt ? 1 : -1)))
    setTitle('')
    setBody('')
    setLinkUrl('')
    setLinkLabel('')
    setFiles([])
    setScheduleEnabled(false)
    setScheduleAt('')
    setStatus(null)
    setPending(false)
  }

  async function remove(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    await deletePost(id)
  }

  return (
    <Panel title="Your posts" headerTight>
      {posts.length === 0 ? (
        <p className="studio-text-muted-sm studio-mb-md">
          Nothing published yet — write one below.
        </p>
      ) : (
        <ul className="studio-list studio-mb-md">
          {posts.map((p) => {
            const isScheduled = new Date(p.publishAt).getTime() > Date.now()
            return (
              <li key={p.id} className="studio-post-row">
                <div className="studio-flex-1">
                  {p.title && <div className="studio-text-sm">{p.title}</div>}
                  <div className="studio-text-muted-sm">
                    {isScheduled ? (
                      <span className="studio-badge studio-badge--pending">
                        Scheduled for {fmtDate(p.publishAt)}
                      </span>
                    ) : (
                      <>Published {fmtDate(p.publishAt)}</>
                    )}
                  </div>
                  <p className="studio-text-sm studio-mt-xs">{p.body}</p>
                  {p.linkUrl && (
                    <a
                      href={p.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="studio-text-sm studio-post-row__link"
                    >
                      {p.linkLabel || p.linkUrl}
                    </a>
                  )}
                  {p.images.length > 0 && (
                    <div className="studio-post-row__images">
                      {p.images.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt="" className="studio-post-row__image" />
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => remove(p.id)}
                  variant="ghost"
                  size="sm"
                  className="studio-text-error"
                >
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      )}

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
        <span className="studio-label">What&apos;s new?</span>
        <textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="studio-input"
          disabled={pending}
          placeholder="Share news, updates, or an announcement…"
        />
      </label>
      <label className="studio-field studio-mt-sm">
        <span className="studio-label">Images (optional, up to {MAX_IMAGES})</span>
        <input
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          disabled={pending}
          className="studio-input"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_IMAGES))}
        />
        {files.length > 0 && (
          <p className="studio-text-muted-sm studio-mt-xs">{files.length} image(s) selected</p>
        )}
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
            placeholder="e.g. Get tickets"
          />
        </label>
      )}

      <label className="studio-label-row studio-mt-sm">
        <input
          type="checkbox"
          checked={scheduleEnabled}
          disabled={pending}
          onChange={(e) => setScheduleEnabled(e.target.checked)}
        />
        Schedule for later
      </label>
      {scheduleEnabled && (
        <label className="studio-field studio-mt-xs">
          <span className="studio-label">Publish at</span>
          <input
            type="datetime-local"
            value={scheduleAt}
            min={minDatetimeLocal()}
            disabled={pending}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="studio-input"
          />
        </label>
      )}

      <Button onClick={publish} disabled={pending} variant="primary" className="studio-mt-sm">
        <ButtonIcon name="send" />
        {status ?? (scheduleEnabled ? 'Schedule post' : 'Publish')}
      </Button>
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </Panel>
  )
}
