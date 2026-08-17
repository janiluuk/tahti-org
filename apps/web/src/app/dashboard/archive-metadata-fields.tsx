// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { TracklistEntry, ChannelGalleryMode, ReleaseCredit } from '@tahti/shared'
import {
  ARCHIVE_GENRES,
  ARCHIVE_CONTENT_TYPES,
  ARCHIVE_LICENSES,
  ARCHIVE_LICENSE_LABELS,
  ARCHIVE_METADATA_DEFAULTS,
  CONTENT_TYPE_LABELS,
} from '../../lib/archive-metadata-options'
import {
  CHANNEL_GALLERY_MODES,
  CHANNEL_GALLERY_MODE_HINTS,
  CHANNEL_GALLERY_MODE_LABELS,
  isWebGLGalleryMode,
  RELEASE_CREDIT_ROLES,
} from '@tahti/shared'
import { TracklistEditor } from './tracklist-editor'
import { CoverImageUpload } from '@/components/cover-image-upload'
import { VenuePicker } from './venue-picker'
import { shouldShowTracklist, shouldShowVenueLocation } from './archive-editor-visibility'
import {
  prepareArchiveBannerUpload,
  completeArchiveBannerUpload,
  fetchArchiveBannerFromUrl,
} from './archive-actions'
import { Button, ButtonIcon } from '@tahti/ui'

export type ArchiveMetadataFormState = {
  description: string
  artistName: string
  credits: ReleaseCredit[]
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
  galleryMode: ChannelGalleryMode
  galleryAudioReactive: boolean
  commentary: string
  taggedNote: string
  isPublic: boolean
  commentsEnabled: boolean
  selectsOptIn: boolean
  topListsEligible: boolean
  tracklist: TracklistEntry[] | null
}

const EMPTY_CREDIT: ReleaseCredit = { role: 'performer', name: '' }

function parseCredits(value: unknown): ReleaseCredit[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (row): row is ReleaseCredit =>
      Boolean(row) &&
      typeof row === 'object' &&
      typeof (row as ReleaseCredit).name === 'string' &&
      RELEASE_CREDIT_ROLES.includes((row as ReleaseCredit).role),
  )
}

export function defaultMetadataFormState(): ArchiveMetadataFormState {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
  return {
    description: '',
    artistName: '',
    credits: [],
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
    galleryMode: 'NONE',
    galleryAudioReactive: false,
    commentary: '',
    taggedNote: '',
    isPublic: ARCHIVE_METADATA_DEFAULTS.isPublic,
    commentsEnabled: true,
    selectsOptIn: ARCHIVE_METADATA_DEFAULTS.selectsOptIn,
    topListsEligible: true,
    tracklist: null,
  }
}

export function metadataFormToPayload(state: ArchiveMetadataFormState): Record<string, unknown> {
  const subGenres = state.subGenres
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12)

  const credits = state.credits
    .map((c) => {
      const handle = c.artistUsername?.trim().replace(/^@/, '').toLowerCase()
      return {
        role: c.role,
        name: c.name.trim(),
        ...(handle && /^[a-z0-9_-]{2,32}$/.test(handle) ? { artistUsername: handle } : {}),
      }
    })
    .filter((c) => c.name.length > 0)

  return {
    description: state.description.trim() || undefined,
    artistName: state.artistName.trim() || null,
    credits: credits.length > 0 ? credits : null,
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
    galleryMode: state.galleryMode,
    galleryAudioReactive: state.galleryAudioReactive,
    commentary: state.commentary.trim() || undefined,
    taggedNote: state.taggedNote.trim() || undefined,
    isPublic: state.isPublic,
    commentsEnabled: state.commentsEnabled,
    selectsOptIn: state.selectsOptIn,
    topListsEligible: state.topListsEligible,
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
    artistName: (item.artistName as string) ?? '',
    credits: parseCredits(item.credits),
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
    galleryMode: (item.galleryMode as ChannelGalleryMode) ?? 'NONE',
    galleryAudioReactive: (item.galleryAudioReactive as boolean) ?? false,
    commentary: (item.commentary as string) ?? '',
    taggedNote: (item.taggedNote as string) ?? '',
    isPublic: (item.isPublic as boolean) ?? true,
    commentsEnabled: (item.commentsEnabled as boolean) ?? true,
    selectsOptIn: (item.selectsOptIn as boolean) ?? false,
    topListsEligible: (item.topListsEligible as boolean) ?? true,
    tracklist: Array.isArray(item.tracklist) ? (item.tracklist as TracklistEntry[]) : null,
  }
}

type SectionProps = {
  state: ArchiveMetadataFormState
  onChange: (next: ArchiveMetadataFormState) => void
  disabled?: boolean
}

/** Essentials — the handful of fields that actually shape how a track shows
 * up. Everything else has a sane default and lives under "Advanced". */
export function ArchiveBasicsFields({
  state,
  onChange,
  disabled,
}: SectionProps & { itemId?: string }) {
  const set = (patch: Partial<ArchiveMetadataFormState>) => onChange({ ...state, ...patch })

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
            {ARCHIVE_GENRES.map((g) => (
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

/** Cover art, background, slideshow — everything a listener sees behind the track. */
export function ArchiveVisualsFields({
  state,
  onChange,
  disabled,
  itemId,
}: SectionProps & { itemId?: string }) {
  const set = (patch: Partial<ArchiveMetadataFormState>) => onChange({ ...state, ...patch })

  return (
    <div className="studio-grid">
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

      <details className="studio-details-block">
        <summary className="studio-details-block__summary">Slideshow (optional)</summary>
        <div className="studio-details-block__body">
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

          {state.slideshowUrls.trim() && (
            <>
              <label className="studio-field">
                <span className="studio-label">Slideshow transition</span>
                <select
                  value={state.galleryMode}
                  disabled={disabled}
                  onChange={(e) => set({ galleryMode: e.target.value as ChannelGalleryMode })}
                  className="studio-input"
                >
                  {CHANNEL_GALLERY_MODES.filter((m) => m !== 'STATIC_SLIDESHOW').map((mode) => (
                    <option key={mode} value={mode}>
                      {CHANNEL_GALLERY_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
                {CHANNEL_GALLERY_MODE_HINTS[state.galleryMode] && (
                  <span className="studio-text-muted-sm">
                    {CHANNEL_GALLERY_MODE_HINTS[state.galleryMode]}
                  </span>
                )}
              </label>

              {isWebGLGalleryMode(state.galleryMode) && (
                <label className="studio-label-row studio-text-sm studio-mb-sm">
                  <input
                    type="checkbox"
                    checked={state.galleryAudioReactive}
                    disabled={disabled}
                    onChange={(e) => set({ galleryAudioReactive: e.target.checked })}
                  />
                  Audio-reactive — images pulse with this track&apos;s playback
                </label>
              )}
            </>
          )}
        </div>
      </details>
    </div>
  )
}

/** Who can hear it and how they can interact — everything defaults to the
 * artist-friendly setting (public, comments on, eligible for discovery). */
export function ArchiveSharingFields({
  state,
  onChange,
  disabled,
  itemId,
}: SectionProps & { itemId?: string }) {
  const set = (patch: Partial<ArchiveMetadataFormState>) => onChange({ ...state, ...patch })

  return (
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
      {itemId && (
        <label className="studio-label-row">
          <input
            type="checkbox"
            checked={state.topListsEligible}
            disabled={disabled}
            onChange={(e) => set({ topListsEligible: e.target.checked })}
          />
          Include in top lists
        </label>
      )}
    </div>
  )
}

/** Everything else — venue, BPM/key, license, extra credits, liner notes.
 * All of it already has a working default, so it's fine to never touch this tab. */
export function ArchiveAdvancedFields({
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
  const set = (patch: Partial<ArchiveMetadataFormState>) => onChange({ ...state, ...patch })

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
            {ARCHIVE_LICENSES.map((l) => (
              <option key={l} value={l}>
                {ARCHIVE_LICENSE_LABELS[l]}
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

/** Tracklist — its own tab since a multi-track DJ set can have dozens of entries. */
export function ArchiveTracklistField({ state, onChange, disabled }: SectionProps) {
  return (
    <TracklistEditor
      value={state.tracklist}
      onChange={(tracklist) => onChange({ ...state, tracklist })}
      disabled={disabled}
    />
  )
}

/** Full flowing form — every section in one column, used by the upload wizard
 * where there's no tabbed editor chrome yet (a track doesn't exist to switch
 * "tabs" on until it's actually uploaded). */
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
  return (
    <div className="studio-grid studio-mt-md">
      <ArchiveBasicsFields state={state} onChange={onChange} disabled={disabled} itemId={itemId} />
      {shouldShowTracklist(state.contentType) && (
        <details className="studio-details-block" open>
          <summary className="studio-details-block__summary">Tracklist</summary>
          <div className="studio-details-block__body">
            <ArchiveTracklistField state={state} onChange={onChange} disabled={disabled} />
          </div>
        </details>
      )}
      <details className="studio-details-block">
        <summary className="studio-details-block__summary">Cover &amp; visuals</summary>
        <div className="studio-details-block__body">
          <ArchiveVisualsFields
            state={state}
            onChange={onChange}
            disabled={disabled}
            itemId={itemId}
          />
        </div>
      </details>
      <details className="studio-details-block">
        <summary className="studio-details-block__summary">Visibility &amp; discovery</summary>
        <div className="studio-details-block__body">
          <ArchiveSharingFields
            state={state}
            onChange={onChange}
            disabled={disabled}
            itemId={itemId}
          />
        </div>
      </details>
      <details className="studio-details-block">
        <summary className="studio-details-block__summary">Advanced</summary>
        <div className="studio-details-block__body">
          <ArchiveAdvancedFields
            state={state}
            onChange={onChange}
            disabled={disabled}
            detectedBpm={detectedBpm}
            detectedKey={detectedKey}
          />
        </div>
      </details>
    </div>
  )
}
