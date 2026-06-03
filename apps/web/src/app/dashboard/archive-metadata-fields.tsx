// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { TracklistEntry } from '@tahti/shared'
import {
  ARCHIVE_GENRES,
  ARCHIVE_CONTENT_TYPES,
  ARCHIVE_LICENSES,
  ARCHIVE_LICENSE_LABELS,
  ARCHIVE_METADATA_DEFAULTS,
  CONTENT_TYPE_LABELS,
} from '../../lib/archive-metadata-options'
import { TracklistEditor } from './tracklist-editor'

export type ArchiveMetadataFormState = {
  description: string
  genre: string
  genreCustom: string
  recordingLocation: string
  subGenres: string
  contentType: string
  mixVersion: string
  bpm: string
  musicalKey: string
  useDetectedBpmKey: boolean
  isAiGenerated: boolean
  releasedAt: string
  license: string
  repostToDownload: boolean
  followToDownload: boolean
  bannerUrl: string
  backgroundUrl: string
  slideshowUrls: string
  commentary: string
  taggedNote: string
  isPublic: boolean
  tracklist: TracklistEntry[] | null
}

export function defaultMetadataFormState(): ArchiveMetadataFormState {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
  return {
    description: '',
    genre: 'Electronic',
    genreCustom: '',
    recordingLocation: '',
    subGenres: '',
    contentType: ARCHIVE_METADATA_DEFAULTS.contentType,
    mixVersion: '',
    bpm: '',
    musicalKey: '',
    useDetectedBpmKey: ARCHIVE_METADATA_DEFAULTS.useDetectedBpmKey,
    isAiGenerated: ARCHIVE_METADATA_DEFAULTS.isAiGenerated,
    releasedAt: local,
    license: ARCHIVE_METADATA_DEFAULTS.license,
    repostToDownload: ARCHIVE_METADATA_DEFAULTS.repostToDownload,
    followToDownload: ARCHIVE_METADATA_DEFAULTS.followToDownload,
    bannerUrl: '',
    backgroundUrl: '',
    slideshowUrls: '',
    commentary: '',
    taggedNote: '',
    isPublic: ARCHIVE_METADATA_DEFAULTS.isPublic,
    tracklist: null,
  }
}

export function metadataFormToPayload(state: ArchiveMetadataFormState): Record<string, unknown> {
  const subGenres = state.subGenres
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)

  return {
    description: state.description.trim() || undefined,
    genre: state.genre || undefined,
    genreCustom: state.genreCustom.trim() || undefined,
    recordingLocation: state.recordingLocation.trim() || undefined,
    subGenres: subGenres.length ? subGenres : undefined,
    contentType: state.contentType,
    mixVersion: state.mixVersion.trim() || undefined,
    bpm: state.bpm ? parseInt(state.bpm, 10) : undefined,
    musicalKey: state.musicalKey.trim() || undefined,
    useDetectedBpmKey: state.useDetectedBpmKey,
    isAiGenerated: state.isAiGenerated,
    releasedAt: state.releasedAt ? new Date(state.releasedAt).toISOString() : undefined,
    license: state.license,
    repostToDownload: state.repostToDownload,
    followToDownload: state.followToDownload,
    bannerUrl: state.bannerUrl.trim() || undefined,
    backgroundUrl: state.backgroundUrl.trim() || undefined,
    slideshowUrls: state.slideshowUrls
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10),
    commentary: state.commentary.trim() || undefined,
    taggedNote: state.taggedNote.trim() || undefined,
    isPublic: state.isPublic,
    tracklist: state.tracklist,
  }
}

export function metadataFromApi(item: Record<string, unknown>): ArchiveMetadataFormState {
  const released = item.releasedAt as string | undefined
  const localReleased = released
    ? new Date(released).toISOString().slice(0, 16)
    : defaultMetadataFormState().releasedAt

  return {
    description: (item.description as string) ?? '',
    genre: (item.genre as string) ?? 'Electronic',
    genreCustom: (item.genreCustom as string) ?? '',
    recordingLocation: (item.recordingLocation as string) ?? '',
    subGenres: Array.isArray(item.subGenres) ? (item.subGenres as string[]).join(', ') : '',
    contentType: (item.contentType as string) ?? ARCHIVE_METADATA_DEFAULTS.contentType,
    mixVersion: (item.mixVersion as string) ?? '',
    bpm: item.bpm != null ? String(item.bpm) : '',
    musicalKey: (item.musicalKey as string) ?? '',
    useDetectedBpmKey: (item.useDetectedBpmKey as boolean) ?? true,
    isAiGenerated: (item.isAiGenerated as boolean) ?? false,
    releasedAt: localReleased,
    license: (item.license as string) ?? ARCHIVE_METADATA_DEFAULTS.license,
    repostToDownload: (item.repostToDownload as boolean) ?? false,
    followToDownload: (item.followToDownload as boolean) ?? false,
    bannerUrl: (item.bannerUrl as string) ?? '',
    backgroundUrl: (item.backgroundUrl as string) ?? '',
    slideshowUrls: Array.isArray(item.slideshowUrls)
      ? (item.slideshowUrls as string[]).join('\n')
      : '',
    commentary: (item.commentary as string) ?? '',
    taggedNote: (item.taggedNote as string) ?? '',
    isPublic: (item.isPublic as boolean) ?? true,
    tracklist: Array.isArray(item.tracklist) ? (item.tracklist as TracklistEntry[]) : null,
  }
}

const fieldStyle = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  border: '1px solid #ccc',
  borderRadius: 4,
  fontSize: '0.95rem',
} as const

const labelStyle = {
  display: 'block',
  marginBottom: '0.25rem',
  fontWeight: 500,
  fontSize: '0.9rem',
} as const

export function ArchiveMetadataFields({
  state,
  onChange,
  disabled,
  detectedBpm,
  detectedKey,
}: {
  state: ArchiveMetadataFormState
  onChange: (next: ArchiveMetadataFormState) => void
  disabled?: boolean
  detectedBpm?: number | null
  detectedKey?: string | null
}) {
  const set = (patch: Partial<ArchiveMetadataFormState>) => onChange({ ...state, ...patch })

  return (
    <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label>
          <span style={labelStyle}>Genre</span>
          <select
            value={state.genre}
            disabled={disabled}
            onChange={(e) => set({ genre: e.target.value })}
            style={fieldStyle}
          >
            {ARCHIVE_GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={labelStyle}>Custom genre</span>
          <input
            type="text"
            placeholder="Not in the list?"
            value={state.genreCustom}
            disabled={disabled}
            onChange={(e) => set({ genreCustom: e.target.value })}
            style={fieldStyle}
          />
        </label>
      </div>

      <label>
        <span style={labelStyle}>Recording location</span>
        <input
          type="text"
          placeholder="Helsinki, Finland"
          value={state.recordingLocation}
          disabled={disabled}
          onChange={(e) => set({ recordingLocation: e.target.value })}
          style={fieldStyle}
        />
      </label>

      <label>
        <span style={labelStyle}>Sub-genres (comma-separated)</span>
        <input
          type="text"
          value={state.subGenres}
          disabled={disabled}
          onChange={(e) => set({ subGenres: e.target.value })}
          style={fieldStyle}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <label>
          <span style={labelStyle}>Type</span>
          <select
            value={state.contentType}
            disabled={disabled}
            onChange={(e) => set({ contentType: e.target.value })}
            style={fieldStyle}
          >
            {ARCHIVE_CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={labelStyle}>Version</span>
          <input
            type="text"
            placeholder="Original Mix"
            value={state.mixVersion}
            disabled={disabled}
            onChange={(e) => set({ mixVersion: e.target.value })}
            style={fieldStyle}
          />
        </label>
        <label>
          <span style={labelStyle}>Release date</span>
          <input
            type="datetime-local"
            value={state.releasedAt}
            disabled={disabled}
            onChange={(e) => set({ releasedAt: e.target.value })}
            style={fieldStyle}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <label>
          <span style={labelStyle}>BPM</span>
          <input
            type="number"
            min={40}
            max={300}
            placeholder="118"
            value={state.bpm}
            disabled={disabled || state.useDetectedBpmKey}
            onChange={(e) => set({ bpm: e.target.value })}
            style={fieldStyle}
          />
        </label>
        <label>
          <span style={labelStyle}>Key</span>
          <input
            type="text"
            placeholder="Em"
            value={state.musicalKey}
            disabled={disabled || state.useDetectedBpmKey}
            onChange={(e) => set({ musicalKey: e.target.value })}
            style={fieldStyle}
          />
        </label>
        <label>
          <span style={labelStyle}>License</span>
          <select
            value={state.license}
            disabled={disabled}
            onChange={(e) => set({ license: e.target.value })}
            style={fieldStyle}
          >
            {ARCHIVE_LICENSES.map((l) => (
              <option key={l} value={l}>
                {ARCHIVE_LICENSE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label
        style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem' }}
      >
        <input
          type="checkbox"
          checked={state.useDetectedBpmKey}
          disabled={disabled}
          onChange={(e) => set({ useDetectedBpmKey: e.target.checked })}
          style={{ marginTop: 2 }}
        />
        <span>
          Use auto-detected tags (embedded file tags when present; otherwise BPM and key are
          analyzed from the audio — first ~2 minutes for long files)
          {(detectedBpm != null || detectedKey) && (
            <span style={{ color: '#666' }}>
              {' '}
              — detected:{' '}
              {[detectedBpm != null ? `${detectedBpm} BPM` : null, detectedKey ?? null]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
        </span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
        <input
          type="checkbox"
          checked={state.isAiGenerated}
          disabled={disabled}
          onChange={(e) => set({ isAiGenerated: e.target.checked })}
        />
        Produced using AI technology
      </label>

      <label>
        <span style={labelStyle}>Description</span>
        <textarea
          rows={2}
          value={state.description}
          disabled={disabled}
          onChange={(e) => set({ description: e.target.value })}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </label>

      <label>
        <span style={labelStyle}>Commentary (liner notes)</span>
        <textarea
          rows={3}
          value={state.commentary}
          disabled={disabled}
          onChange={(e) => set({ commentary: e.target.value })}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </label>

      <label>
        <span style={labelStyle}>Tag people (@username in notes)</span>
        <textarea
          rows={2}
          placeholder="@collaborator — credit in description"
          value={state.taggedNote}
          disabled={disabled}
          onChange={(e) => set({ taggedNote: e.target.value })}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <label>
          <span style={labelStyle}>Cover image URL</span>
          <input
            type="url"
            value={state.bannerUrl}
            disabled={disabled}
            onChange={(e) => set({ bannerUrl: e.target.value })}
            style={fieldStyle}
          />
        </label>
        <label>
          <span style={labelStyle}>Background image URL</span>
          <input
            type="url"
            value={state.backgroundUrl}
            disabled={disabled}
            onChange={(e) => set({ backgroundUrl: e.target.value })}
            style={fieldStyle}
          />
        </label>
      </div>

      <label>
        <span style={labelStyle}>Slideshow image URLs (one per line, max 10)</span>
        <textarea
          rows={2}
          placeholder="https://cdn.example/slide1.jpg"
          value={state.slideshowUrls}
          disabled={disabled}
          onChange={(e) => set({ slideshowUrls: e.target.value })}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </label>

      <TracklistEditor
        value={state.tracklist}
        onChange={(tracklist) => set({ tracklist })}
        disabled={disabled}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <input
            type="checkbox"
            checked={state.isPublic}
            disabled={disabled}
            onChange={(e) => set({ isPublic: e.target.checked })}
          />
          Public on channel
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <input
            type="checkbox"
            checked={state.repostToDownload}
            disabled={disabled}
            onChange={(e) => set({ repostToDownload: e.target.checked })}
          />
          Repost to download
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <input
            type="checkbox"
            checked={state.followToDownload}
            disabled={disabled}
            onChange={(e) => set({ followToDownload: e.target.checked })}
          />
          Follow to download
        </label>
      </div>
    </div>
  )
}
