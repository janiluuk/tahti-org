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

export function PostsManager({ initialPosts }: { initialPosts: ArtistPostView[] }) {
  const [posts, setPosts] = useState(initialPosts)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function publish() {
    if (!body.trim()) {
      setError('Write something first.')
      return
    }
    setPending(true)
    setError(null)
    setStatus('Publishing…')

    const created = await createPost({ title: title.trim() || undefined, body: body.trim() })
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

    setPosts((prev) => [finalPost, ...prev])
    setTitle('')
    setBody('')
    setFiles([])
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
          {posts.map((p) => (
            <li key={p.id} className="studio-post-row">
              <div className="studio-flex-1">
                {p.title && <div className="studio-text-sm">{p.title}</div>}
                <div className="studio-text-muted-sm">{fmtDate(p.createdAt)}</div>
                <p className="studio-text-sm studio-mt-xs">{p.body}</p>
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
          ))}
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

      <Button onClick={publish} disabled={pending} variant="primary" className="studio-mt-sm">
        <ButtonIcon name="send" />
        {status ?? 'Publish'}
      </Button>
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </Panel>
  )
}
