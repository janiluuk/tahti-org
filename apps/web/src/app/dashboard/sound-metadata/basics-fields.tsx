// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import {
  SOUND_GENRES,
  SOUND_CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
} from '../../../lib/sound-metadata-options'
import type { SectionProps, SoundMetadataFormState } from './types'

/** Essentials — the handful of fields that actually shape how a track shows
 * up. Everything else has a sane default and lives under "Advanced". */
export function SoundBasicsFields({
  state,
  onChange,
  disabled,
}: SectionProps & { itemId?: string }) {
  const set = (patch: Partial<SoundMetadataFormState>) => onChange({ ...state, ...patch })

  return (
    <div className="studio-grid">
      <div className="studio-grid studio-grid--2">
        <label className="studio-field">
          <span className="studio-label">Genre</span>
          <select
            value={state.genre}
            disabled={disabled}
            onChange={(e) => set({ genre: e.target.value })}
            className="studio-input"
          >
            {SOUND_GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        {(state.genre === 'Other' || state.genreCustom.trim().length > 0) && (
          <label className="studio-field">
            <span className="studio-label">Custom genre</span>
            <input
              type="text"
              placeholder="Not in the list?"
              value={state.genreCustom}
              disabled={disabled}
              onChange={(e) => set({ genreCustom: e.target.value })}
              className="studio-input"
            />
          </label>
        )}
      </div>

      <div className="studio-grid studio-grid--2">
        <label className="studio-field">
          <span className="studio-label">Type</span>
          <select
            value={state.contentType}
            disabled={disabled}
            onChange={(e) => set({ contentType: e.target.value })}
            className="studio-input"
          >
            {SOUND_CONTENT_TYPES.filter((t) => t !== 'LIVE').map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          {state.contentType !== 'DJ_SET' && (
            <p className="studio-field-note studio-field-note--warning">
              You must own the rights to this music, or have permission from the rights holder, to
              publish it here.
            </p>
          )}
        </label>
        <label className="studio-field">
          <span className="studio-label">Release date</span>
          <input
            type="datetime-local"
            value={state.releasedAt}
            disabled={disabled}
            onChange={(e) => set({ releasedAt: e.target.value })}
            className="studio-input"
          />
        </label>
      </div>

      <label className="studio-field">
        <span className="studio-label">Description</span>
        <textarea
          rows={3}
          placeholder="What is this recording? A line or two is plenty."
          value={state.description}
          disabled={disabled}
          onChange={(e) => set({ description: e.target.value })}
          className="studio-textarea"
        />
      </label>
    </div>
  )
}
