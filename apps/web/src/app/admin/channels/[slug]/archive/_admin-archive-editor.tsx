// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ARCHIVE_GENRES,
  ARCHIVE_LICENSE_LABELS,
  CONTENT_TYPE_LABELS,
} from '@/lib/archive-metadata-options'
import { updateAdminArchiveMetadata, type AdminArchiveItem } from './actions'

export function AdminArchiveEditor({ slug, item }: { slug: string; item: AdminArchiveItem }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [genre, setGenre] = useState((item.genre as string | null) ?? ARCHIVE_GENRES[0])
  const [contentType, setContentType] = useState((item.contentType as string | null) ?? 'STUDIO')
  const [license, setLicense] = useState((item.license as string | null) ?? 'ALL_RIGHTS_RESERVED')
  const [description, setDescription] = useState((item.description as string | null) ?? '')
  const [isPublic, setIsPublic] = useState((item.isPublic as boolean | undefined) ?? true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updateAdminArchiveMetadata(slug, item.id, {
        title: title.trim(),
        genre,
        contentType,
        license,
        description: description.trim(),
        isPublic,
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className={`admin-archive-row${open ? ' admin-archive-row--active' : ''}`}>
      <div className="admin-archive-row__header">
        <div>
          <div className="admin-archive-row__title">{item.title}</div>
          <div className="admin-stat-sub">
            {item.status as string}
            {item.contentType != null &&
              ` · ${CONTENT_TYPE_LABELS[item.contentType as string] ?? item.contentType}`}
            {item.genre != null && ` · ${item.genre as string}`}
            {(item.isPublic as boolean | undefined) === false && ' · Unpublished'}
          </div>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--ghost"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close' : 'Edit'}
        </button>
      </div>

      {open && (
        <div className="admin-archive-row__form">
          <label className="studio-field">
            <span className="studio-label">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPending}
              className="studio-input"
            />
          </label>

          <div className="studio-grid studio-grid--2">
            <label className="studio-field">
              <span className="studio-label">Genre</span>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                disabled={isPending}
                className="studio-input"
              >
                {ARCHIVE_GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="studio-field">
              <span className="studio-label">Content type</span>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                disabled={isPending}
                className="studio-input"
              >
                {Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="studio-field">
            <span className="studio-label">License</span>
            <select
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              disabled={isPending}
              className="studio-input"
            >
              {Object.entries(ARCHIVE_LICENSE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="studio-field">
            <span className="studio-label">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              className="studio-input"
              rows={3}
            />
          </label>

          <label className="studio-checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              disabled={isPending}
            />
            <span>Public (visible on the channel page)</span>
          </label>

          <div className="studio-actions studio-mt-lg">
            <button
              type="button"
              className="ui-btn ui-btn--primary ui-btn--sm"
              onClick={save}
              disabled={isPending || !title.trim()}
            >
              {isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
          {error && <p className="studio-notice studio-notice--error">{error}</p>}
        </div>
      )}
    </div>
  )
}
