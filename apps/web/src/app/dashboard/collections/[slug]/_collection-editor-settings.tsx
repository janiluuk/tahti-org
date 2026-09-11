// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { ButtonIcon, Button } from '@tahti/ui'
import { CoverImageUpload } from '@/components/cover-image-upload'
import {
  prepareCollectionCoverUpload,
  completeCollectionCoverUpload,
  fetchCollectionCoverFromUrl,
} from '../../collection-actions'
import { STYLE_LABEL } from '../collection-labels'

const SORT_MODE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual (drag to reorder)' },
  { value: 'TIME', label: 'By time added' },
  { value: 'NAME', label: 'By name' },
]

const STYLE_OPTIONS = ['PLAYLIST', 'ALBUM', 'EP', 'SINGLE', 'DJ_SET_SERIES', 'PODCAST']

export function CollectionEditorSettings({
  collectionId,
  collectionSlug,
  collectionName,
  name,
  onNameChange,
  style,
  onStyleChange,
  trackSortMode,
  onTrackSortModeChange,
  isPublic,
  onIsPublicChange,
  isFeatured,
  onIsFeaturedChange,
  collaborative,
  onCollaborativeChange,
  description,
  onDescriptionChange,
  coverUrl,
  onCoverUrlChange,
  settingsError,
  settingsDirty,
  settingsSaving,
  isPending,
  onSaveSettings,
  settingsSaved,
  confirmDelete,
  onConfirmDeleteChange,
  onDelete,
  deleting,
}: {
  collectionId: string
  collectionSlug: string
  collectionName: string
  name: string
  onNameChange: (value: string) => void
  style: string
  onStyleChange: (value: string) => void
  trackSortMode: string
  onTrackSortModeChange: (value: string) => void
  isPublic: boolean
  onIsPublicChange: (value: boolean) => void
  isFeatured: boolean
  onIsFeaturedChange: (value: boolean) => void
  collaborative: boolean
  onCollaborativeChange: (value: boolean) => void
  description: string
  onDescriptionChange: (value: string) => void
  coverUrl: string | null
  onCoverUrlChange: (url: string) => void
  settingsError: string | null
  settingsDirty: boolean
  settingsSaving: boolean
  isPending: boolean
  onSaveSettings: () => void
  settingsSaved: boolean
  confirmDelete: boolean
  onConfirmDeleteChange: (value: boolean) => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <aside className="collection-editor__settings">
      <h2 className="collection-editor__section-title">Settings</h2>

      <div className="studio-field">
        <label className="studio-label" htmlFor={`collection-name-${collectionId}`}>
          Name
        </label>
        <input
          id={`collection-name-${collectionId}`}
          className="studio-input"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={100}
        />
      </div>

      {(style === 'DJ_SET_SERIES' || style === 'PODCAST') && (
        <Link
          href={`/dashboard/schedule?seriesName=${encodeURIComponent(name)}&format=${style === 'PODCAST' ? 'TALK' : 'LIVE_SET'}${coverUrl ? `&artwork=${encodeURIComponent(coverUrl)}` : ''}`}
          className="ui-btn ui-btn--secondary"
        >
          <ButtonIcon name="plus" />
          Schedule next episode
        </Link>
      )}

      <div className="studio-field">
        <span className="studio-label">Style</span>
        <div className="collection-form__style-grid">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className={`collection-form__style-pill${
                style === s ? ' collection-form__style-pill--active' : ''
              }`}
              onClick={() => onStyleChange(s)}
            >
              {STYLE_LABEL[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="studio-field">
        <label className="studio-label" htmlFor={`collection-sort-${collectionId}`}>
          Track order
        </label>
        <select
          id={`collection-sort-${collectionId}`}
          className="studio-input"
          value={trackSortMode}
          onChange={(e) => onTrackSortModeChange(e.target.value)}
        >
          {SORT_MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="studio-field">
        <CoverImageUpload
          currentUrl={coverUrl}
          label="Cover image"
          prepare={(args) => prepareCollectionCoverUpload(collectionSlug, args)}
          complete={(uploadKey) => completeCollectionCoverUpload(collectionSlug, uploadKey)}
          fromUrl={(sourceUrl) => fetchCollectionCoverFromUrl(collectionSlug, sourceUrl)}
          onUploaded={(url) => onCoverUrlChange(url)}
        />
      </div>

      <fieldset className="collection-form__vis-fieldset">
        <legend className="studio-label">Visibility</legend>
        <div className="collection-form__vis-row">
          <label className="collection-form__vis-option">
            <input
              type="radio"
              name={`vis-${collectionId}`}
              checked={isPublic}
              onChange={() => onIsPublicChange(true)}
            />
            <span className="collection-form__vis-copy">
              <span className="collection-form__vis-label">Public</span>
              <span className="collection-form__vis-desc">Visible on your profile</span>
            </span>
          </label>
          <label className="collection-form__vis-option">
            <input
              type="radio"
              name={`vis-${collectionId}`}
              checked={!isPublic}
              onChange={() => onIsPublicChange(false)}
            />
            <span className="collection-form__vis-copy">
              <span className="collection-form__vis-label">Draft</span>
              <span className="collection-form__vis-desc">Only you can see it</span>
            </span>
          </label>
        </div>
      </fieldset>

      <label className="collection-form__vis-option collection-form__featured-row">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => onIsFeaturedChange(e.target.checked)}
        />
        <span className="collection-form__vis-label">Featured on profile</span>
      </label>

      {style === 'PLAYLIST' && (
        <label className="collection-form__vis-option collection-form__featured-row">
          <input
            type="checkbox"
            checked={collaborative}
            disabled={!isPublic}
            onChange={(e) => onCollaborativeChange(e.target.checked)}
          />
          <span className="collection-form__vis-copy">
            <span className="collection-form__vis-label">Collaborative playlist</span>
            <span className="collection-form__vis-desc">
              {isPublic
                ? 'Any logged-in listener can add tracks from the Tahti catalog'
                : 'Only public playlists can be collaborative'}
            </span>
          </span>
        </label>
      )}

      <div className="studio-field">
        <label className="studio-label" htmlFor={`collection-desc-${collectionId}`}>
          Description
        </label>
        <textarea
          id={`collection-desc-${collectionId}`}
          className="studio-input collection-form__textarea"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          maxLength={1000}
          rows={4}
        />
      </div>

      {settingsError && <p className="studio-text-error studio-text-sm">{settingsError}</p>}

      {settingsDirty && (
        <Button
          onClick={() => void onSaveSettings()}
          disabled={settingsSaving || isPending}
          variant="primary"
        >
          <ButtonIcon name="save" />
          {settingsSaving ? 'Saving…' : 'Save settings'}
        </Button>
      )}
      {settingsSaved && !settingsDirty && <span className="collection-editor__saved">Saved</span>}

      <div className="collection-editor__danger">
        <h3 className="collection-editor__danger-title">Danger zone</h3>
        {!confirmDelete ? (
          <Button
            onClick={() => onConfirmDeleteChange(true)}
            variant="ghost"
            size="sm"
            className="collection-editor__delete-btn"
          >
            Delete collection
          </Button>
        ) : (
          <div className="collection-editor__confirm-delete">
            <p>Delete &ldquo;{collectionName}&rdquo;? This removes it from all smart links.</p>
            <div className="collection-editor__confirm-btns">
              <Button onClick={() => onConfirmDeleteChange(false)} variant="ghost" size="sm">
                Cancel
              </Button>
              <Button
                onClick={() => void onDelete()}
                disabled={deleting}
                variant="primary"
                className="collection-editor__delete-confirm"
              >
                <ButtonIcon name="trash" />
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

export { SORT_MODE_OPTIONS }
