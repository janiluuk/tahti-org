// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { ChannelGalleryMode } from '@tahti/shared'
import {
  CHANNEL_GALLERY_MODES,
  CHANNEL_GALLERY_MODE_HINTS,
  CHANNEL_GALLERY_MODE_LABELS,
  isWebGLGalleryMode,
} from '@tahti/shared'
import { CoverImageUpload } from '@/components/cover-image-upload'
import {
  prepareSoundBannerUpload,
  completeSoundBannerUpload,
  fetchSoundBannerFromUrl,
} from '../sound-actions'
import type { SectionProps, SoundMetadataFormState } from './types'

/** Cover art, background, slideshow — everything a listener sees behind the track. */
export function SoundVisualsFields({
  state,
  onChange,
  disabled,
  itemId,
}: SectionProps & { itemId?: string }) {
  const set = (patch: Partial<SoundMetadataFormState>) => onChange({ ...state, ...patch })

  return (
    <div className="studio-grid">
      {itemId && (
        <CoverImageUpload
          currentUrl={state.bannerUrl || null}
          label="Upload cover image"
          prepare={(args) => prepareSoundBannerUpload(itemId, args)}
          complete={(uploadKey) => completeSoundBannerUpload(itemId, uploadKey)}
          fromUrl={(sourceUrl) => fetchSoundBannerFromUrl(itemId, sourceUrl)}
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
