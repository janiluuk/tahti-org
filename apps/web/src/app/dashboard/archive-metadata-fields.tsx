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
import { CoverImageUpload } from '@/components/cover-image-upload'
import { VenuePicker } from './venue-picker'
import {
  prepareArchiveBannerUpload,
  completeArchiveBannerUpload,
  fetchArchiveBannerFromUrl,
} from './archive-actions'

export type ArchiveMetadataFormState = {
  description: string
  genre: string
  genreCustom: string
  recordingLocation: string
  venueId: string | null
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
  commentsEnabled: boolean
  selectsOptIn: boolean
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
    venueId: null,
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
    commentsEnabled: true,
    selectsOptIn: ARCHIVE_METADATA_DEFAULTS.selectsOptIn,
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
    venueId: state.venueId,
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
    commentsEnabled: state.commentsEnabled,
    selectsOptIn: state.selectsOptIn,
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
    venueId: (item.venueId as string | null) ?? null,
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
    commentsEnabled: (item.commentsEnabled as boolean) ?? true,
    selectsOptIn: (item.selectsOptIn as boolean) ?? false,
    tracklist: Array.isArray(item.tracklist) ? (item.tracklist as TracklistEntry[]) : null,
  }
}

export function ArchiveMetadataFields({
  state,
  onChange,
  disabled,
  detectedBpm,
  detectedKey,
  itemId,
}: {
  state: ArchiveMetadataFormState
  onChange: (next: ArchiveMetadataFormState) => void
  disabled?: boolean
  detectedBpm?: number | null
  detectedKey?: string | null
  itemId?: string
}) {
  const set = (patch: Partial<ArchiveMetadataFormState>) => onChange({ ...state, ...patch })

  return (
    <div className="studio-grid studio-mt-md">
      <div className="studio-grid studio-grid--2">
        <label className="studio-field">
          <span className="studio-label">Genre</span>
          <select
            value={state.genre}
            disabled={disabled}
            onChange={(e) => set({ genre: e.target.value })}
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
      </div>

      <VenuePicker
        venueId={state.venueId}
        disabled={disabled}
        onChange={(venueId) => set({ venueId })}
      />

      <label className="studio-field">
        <span className="studio-label">Recording location notes (optional)</span>
        <input
          type="text"
          placeholder="e.g. backstage, second stage — extra detail beyond the venue"
          value={state.recordingLocation}
          disabled={disabled}
          onChange={(e) => set({ recordingLocation: e.target.value })}
          className="studio-input"
        />
      </label>

      <label className="studio-field">
        <span className="studio-label">Sub-genres (comma-separated)</span>
        <input
          type="text"
          value={state.subGenres}
          disabled={disabled}
          onChange={(e) => set({ subGenres: e.target.value })}
          className="studio-input"
        />
      </label>

      <div className="studio-grid studio-grid--3">
        <label className="studio-field">
          <span className="studio-label">Type</span>
          <select
            value={state.contentType}
            disabled={disabled}
            onChange={(e) => set({ contentType: e.target.value })}
            className="studio-input"
          >
            {ARCHIVE_CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          {state.contentType !== 'DJ_MIX' && (
            <p className="studio-field-note studio-field-note--warning">
              You must own the rights to this music, or have permission from the rights holder, to
              publish it here.
            </p>
          )}
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
        <label className="studio-field">
          <span className="studio-label">License</span>
          <select
            value={state.license}
            disabled={disabled}
            onChange={(e) => set({ license: e.target.value })}
            className="studio-input"
          >
            {ARCHIVE_LICENSES.map((l) => (
              <option key={l} value={l}>
                {ARCHIVE_LICENSE_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="studio-label-row studio-row--start">
        <input
          type="checkbox"
          checked={state.useDetectedBpmKey}
          disabled={disabled}
          onChange={(e) => set({ useDetectedBpmKey: e.target.checked })}
        />
        <span>
          Use auto-detected tags (embedded file tags when present; otherwise BPM and key are
          analyzed from the audio — first ~2 minutes for long files)
          {(detectedBpm != null || detectedKey) && (
            <span className="studio-text-muted-sm">
              {' '}
              — detected:{' '}
              {[detectedBpm != null ? `${detectedBpm} BPM` : null, detectedKey ?? null]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
        </span>
      </label>

      <label className="studio-label-row">
        <input
          type="checkbox"
          checked={state.isAiGenerated}
          disabled={disabled}
          onChange={(e) => set({ isAiGenerated: e.target.checked })}
        />
        Produced using AI technology
      </label>

      <label className="studio-field">
        <span className="studio-label">Description</span>
        <textarea
          rows={2}
          value={state.description}
          disabled={disabled}
          onChange={(e) => set({ description: e.target.value })}
          className="studio-textarea"
        />
      </label>

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

      {itemId && (
        <CoverImageUpload
          currentUrl={state.bannerUrl || null}
          label="Upload cover image"
          prepare={(args) => prepareArchiveBannerUpload(itemId, args)}
          complete={(uploadKey) => completeArchiveBannerUpload(itemId, uploadKey)}
          fromUrl={(sourceUrl) => fetchArchiveBannerFromUrl(itemId, sourceUrl)}
          onUploaded={(url) => set({ bannerUrl: url ?? '' })}
        />
      )}

      <div className="studio-grid studio-grid--2">
        <label className="studio-field">
          <span className="studio-label">Cover image URL</span>
          <input
            type="url"
            value={state.bannerUrl}
            disabled={disabled}
            onChange={(e) => set({ bannerUrl: e.target.value })}
            className="studio-input"
          />
        </label>
        <label className="studio-field">
          <span className="studio-label">Background URL (image or YouTube/Vimeo)</span>
          <input
            type="url"
            placeholder="https://… or https://youtu.be/…"
            value={state.backgroundUrl}
            disabled={disabled}
            onChange={(e) => set({ backgroundUrl: e.target.value })}
            className="studio-input"
          />
        </label>
      </div>

      <label className="studio-field">
        <span className="studio-label">Slideshow image URLs (one per line, max 10)</span>
        <textarea
          rows={2}
          placeholder="https://cdn.example/slide1.jpg"
          value={state.slideshowUrls}
          disabled={disabled}
          onChange={(e) => set({ slideshowUrls: e.target.value })}
          className="studio-textarea"
        />
      </label>

      <TracklistEditor
        value={state.tracklist}
        onChange={(tracklist) => set({ tracklist })}
        disabled={disabled}
      />

      <div className="studio-row studio-row--wrap studio-gap-lg studio-text-sm">
        <label className="studio-label-row">
          <input
            type="checkbox"
            checked={state.isPublic}
            disabled={disabled}
            onChange={(e) => set({ isPublic: e.target.checked })}
          />
          Public on channel
        </label>
        <label className="studio-label-row">
          <input
            type="checkbox"
            checked={state.repostToDownload}
            disabled={disabled}
            onChange={(e) => set({ repostToDownload: e.target.checked })}
          />
          Repost to download
        </label>
        <label className="studio-label-row">
          <input
            type="checkbox"
            checked={state.followToDownload}
            disabled={disabled}
            onChange={(e) => set({ followToDownload: e.target.checked })}
          />
          Follow to download
        </label>
        <label
          className="studio-label-row"
          title="Enter the weekly Tahti Selects rotation draw — up to 3 of your opted-in tracks can be picked per week"
        >
          <input
            type="checkbox"
            checked={state.selectsOptIn}
            disabled={disabled}
            onChange={(e) => set({ selectsOptIn: e.target.checked })}
          />
          Eligible for Tahti Selects
        </label>
        {itemId && (
          <label className="studio-label-row">
            <input
              type="checkbox"
              checked={state.commentsEnabled}
              disabled={disabled}
              onChange={(e) => set({ commentsEnabled: e.target.checked })}
            />
            Allow comments on this track
          </label>
        )}
      </div>
    </div>
  )
}
