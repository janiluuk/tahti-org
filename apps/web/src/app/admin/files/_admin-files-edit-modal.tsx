'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { SOUND_CONTENT_TYPES, type AdminFileRow } from '@tahti/shared'
import type { EditFilePayload } from './_admin-files-types'

export function EditModal({
  row,
  genreOptions,
  onClose,
  onSave,
}: {
  row: AdminFileRow
  genreOptions: string[]
  onClose: () => void
  onSave: (payload: EditFilePayload) => void
}) {
  const [title, setTitle] = useState(row.title)
  const [genre, setGenre] = useState(row.genreCustom || row.genre || '')
  const [contentType, setContentType] = useState(row.contentType)
  const [isPublic, setIsPublic] = useState(row.isPublic)

  return (
    <div className="admin-files-modal" role="dialog" aria-modal aria-label="Edit file">
      <div className="admin-files-modal__card">
        <h2 className="admin-files-modal__title">Edit file</h2>
        <label className="admin-files-modal__field">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="admin-files-modal__field">
          Genre
          <input
            list="admin-files-genres"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
          />
          <datalist id="admin-files-genres">
            {genreOptions.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <label className="admin-files-modal__field">
          Type
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value as (typeof SOUND_CONTENT_TYPES)[number])}
          >
            {SOUND_CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-files-modal__check">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
          Public
        </label>
        <div className="admin-files-modal__actions">
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={() => onSave({ title, genre, contentType, isPublic })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
