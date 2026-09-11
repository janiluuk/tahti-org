// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { ReleaseCredit } from '@tahti/shared'
import { RELEASE_CREDIT_ROLES } from '@tahti/shared'
import { SOUND_LICENSES, SOUND_LICENSE_LABELS } from '../../../lib/sound-metadata-options'
import { VenuePicker } from '../venue-picker'
import { shouldShowVenueLocation } from '../sound-editor-visibility'
import { Button, ButtonIcon } from '@tahti/ui'
import { EMPTY_CREDIT, type SectionProps, type SoundMetadataFormState } from './types'

/** Everything else — venue, BPM/key, license, extra credits, liner notes.
 * All of it already has a working default, so it's fine to never touch this tab. */
export function SoundAdvancedFields({
  state,
  onChange,
  disabled,
  detectedBpm,
  detectedKey,
  showVenueLocation = shouldShowVenueLocation(state.contentType),
}: SectionProps & {
  detectedBpm?: number | null
  detectedKey?: string | null
  showVenueLocation?: boolean
}) {
  const set = (patch: Partial<SoundMetadataFormState>) => onChange({ ...state, ...patch })

  return (
    <div className="studio-grid">
      <div className="studio-field--block">
        <span className="studio-label">Track credit</span>
        <label className="studio-field">
          <span className="studio-label studio-label--secondary">Artist name (override)</span>
          <input
            type="text"
            maxLength={120}
            placeholder="Leave blank to use your channel / band name"
            value={state.artistName}
            disabled={disabled}
            onChange={(e) => set({ artistName: e.target.value })}
            className="studio-input"
          />
        </label>
        <p className="studio-help studio-mt-xs">
          Use when this track&apos;s credit differs from your artist name or band setup (guest
          feature, alias, collaboration).{' '}
          <a href="/dashboard/settings/artist-info#members">Edit Members</a>
        </p>

        <details className="studio-details-block studio-mt-sm">
          <summary className="studio-details-block__summary">Extra credits &amp; roles</summary>
          <div className="studio-details-block__body">
            {state.credits.length === 0 && (
              <p className="studio-empty">
                Optional — add writers, performers, producers when they differ from your Members
                roster.
              </p>
            )}
            <ul className="studio-list studio-mb-sm">
              {state.credits.map((credit, index) => (
                <li key={index} className="studio-grid studio-grid--credits">
                  <select
                    value={credit.role}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...state.credits]
                      next[index] = { ...credit, role: e.target.value as ReleaseCredit['role'] }
                      set({ credits: next })
                    }}
                    className="studio-input"
                    aria-label="Credit role"
                  >
                    {RELEASE_CREDIT_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <input
                    value={credit.name}
                    placeholder="Name"
                    disabled={disabled}
                    maxLength={120}
                    onChange={(e) => {
                      const next = [...state.credits]
                      next[index] = { ...credit, name: e.target.value }
                      set({ credits: next })
                    }}
                    className="studio-input"
                    aria-label="Credit name"
                  />
                  <input
                    value={credit.artistUsername ? `@${credit.artistUsername}` : ''}
                    placeholder="@username"
                    disabled={disabled}
                    maxLength={33}
                    onChange={(e) => {
                      const raw = e.target.value.trim().replace(/^@/, '').toLowerCase()
                      const next = [...state.credits]
                      next[index] = {
                        ...credit,
                        artistUsername: raw.length > 0 ? raw : undefined,
                      }
                      set({ credits: next })
                    }}
                    className="studio-input"
                    aria-label="Tahti username"
                  />
                  <Button
                    disabled={disabled}
                    onClick={() => set({ credits: state.credits.filter((_, i) => i !== index) })}
                    variant="ghost"
                  >
                    <ButtonIcon name="trash" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              disabled={disabled || state.credits.length >= 20}
              onClick={() => set({ credits: [...state.credits, { ...EMPTY_CREDIT }] })}
              variant="ghost"
            >
              <ButtonIcon name="plus" />
              Add credit
            </Button>
          </div>
        </details>
      </div>

      {showVenueLocation && (
        <div className="studio-field--block">
          <span className="studio-label">Venue &amp; location</span>
          <p className="studio-help studio-mt-xs studio-mb-sm">
            Optional — connect this show or recording to a real venue.
          </p>
          <VenuePicker
            venueId={state.venueId}
            disabled={disabled}
            onChange={(venueId) => set({ venueId })}
          />
          <label className="studio-field studio-mt-sm">
            <span className="studio-label studio-label--secondary">
              Extra location notes (optional)
            </span>
            <input
              type="text"
              placeholder="e.g. backstage, second stage — extra detail beyond the venue"
              value={state.recordingLocation}
              disabled={disabled}
              onChange={(e) => set({ recordingLocation: e.target.value })}
              className="studio-input"
            />
          </label>
        </div>
      )}

      <div className="studio-grid studio-grid--3">
        <label className="studio-field">
          <span className="studio-label">Sub-genres</span>
          <input
            type="text"
            placeholder="comma-separated"
            value={state.subGenres}
            disabled={disabled}
            onChange={(e) => set({ subGenres: e.target.value })}
            className="studio-input"
          />
        </label>
        <label className="studio-field">
          <span className="studio-label">Tags</span>
          <input
            type="text"
            placeholder="comma-separated, free-form"
            value={state.tags}
            disabled={disabled}
            onChange={(e) => set({ tags: e.target.value })}
            className="studio-input"
          />
        </label>
        <label className="studio-field">
          <span className="studio-label">Version</span>
          <input
            type="text"
            placeholder="Original Mix"
            value={state.mixVersion}
            disabled={disabled}
            onChange={(e) => set({ mixVersion: e.target.value })}
            className="studio-input"
          />
        </label>
        <label className="studio-field">
          <span className="studio-label">License</span>
          <select
            value={state.license}
            disabled={disabled}
            onChange={(e) => set({ license: e.target.value })}
            className="studio-input"
          >
            {SOUND_LICENSES.map((l) => (
              <option key={l} value={l}>
                {SOUND_LICENSE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="studio-grid studio-grid--3">
        <label className="studio-field">
          <span className="studio-label">BPM</span>
          <input
            type="number"
            min={40}
            max={300}
            placeholder="118"
            value={state.bpm}
            disabled={disabled || state.useDetectedBpmKey}
            onChange={(e) => set({ bpm: e.target.value })}
            className="studio-input"
          />
        </label>
        <label className="studio-field">
          <span className="studio-label">Key</span>
          <input
            type="text"
            placeholder="Em"
            value={state.musicalKey}
            disabled={disabled || state.useDetectedBpmKey}
            onChange={(e) => set({ musicalKey: e.target.value })}
            className="studio-input"
          />
        </label>
        <div />
      </div>

      <label className="studio-label-row">
        <input
          type="checkbox"
          checked={state.useDetectedBpmKey}
          disabled={disabled}
          onChange={(e) => set({ useDetectedBpmKey: e.target.checked })}
        />
        <span>
          Use auto-detected BPM &amp; key
          {(detectedBpm != null || detectedKey) && (
            <span className="studio-text-muted-sm">
              {' '}
              —{' '}
              {[detectedBpm != null ? `${detectedBpm} BPM` : null, detectedKey ?? null]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
        </span>
      </label>
      <p className="studio-help studio-mt-xs">
        Uses embedded file tags when present; otherwise BPM and key are analyzed from the audio
        (first ~2 minutes for long files).
      </p>

      <label className="studio-label-row studio-mt-sm">
        <input
          type="checkbox"
          checked={state.isAiGenerated}
          disabled={disabled}
          onChange={(e) => set({ isAiGenerated: e.target.checked })}
        />
        Produced using AI technology
      </label>

      <details className="studio-details-block">
        <summary className="studio-details-block__summary">Notes &amp; tags</summary>
        <div className="studio-details-block__body studio-grid">
          <label className="studio-field">
            <span className="studio-label">Commentary (liner notes)</span>
            <textarea
              rows={3}
              value={state.commentary}
              disabled={disabled}
              onChange={(e) => set({ commentary: e.target.value })}
              className="studio-textarea"
            />
          </label>

          <label className="studio-field">
            <span className="studio-label">Tag people (@username in notes)</span>
            <textarea
              rows={2}
              placeholder="@collaborator — credit in description"
              value={state.taggedNote}
              disabled={disabled}
              onChange={(e) => set({ taggedNote: e.target.value })}
              className="studio-textarea"
            />
          </label>
        </div>
      </details>
    </div>
  )
}
