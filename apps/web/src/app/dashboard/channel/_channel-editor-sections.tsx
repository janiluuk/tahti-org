// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import ChannelGalleryPanel from '../channel-gallery-panel'
import ChannelTextLayerPanel from '../channel-text-layer-panel'
import ChannelVisualPresetPanel from '../channel-visual-preset-panel'
import { ChannelEditorSection } from './_channel-editor-section'
import { ChannelLivePreview, type ChannelPreviewDraft } from './_channel-live-preview'
import {
  CHANNEL_GALLERY_SOURCE_URL,
  CHANNEL_TEXT_LAYER_SOURCE_URL,
  type ChannelGalleryMode,
  type ChannelTextLayerAlignment,
  type ChannelTextLayerMode,
  type SlideshowPreset,
  type VisualPreset,
} from '@tahti/shared'

export type ChannelEditorData = {
  channelSlug: string
  displayName: string
  avatarUrl: string | null
  channelGallery: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  }
  channelTextLayer: {
    textLayerMode: ChannelTextLayerMode
    textLayerText: string
    textLayerAlign: ChannelTextLayerAlignment
  }
  channelVisual: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
  }
}

/** Full-page channel appearance editor — live preview beside gallery, text layer, and visual style controls. */
export function ChannelEditorSections({
  channelSlug,
  displayName,
  avatarUrl,
  channelGallery,
  channelTextLayer,
  channelVisual,
}: ChannelEditorData) {
  const [draft, setDraft] = useState<ChannelPreviewDraft>({
    displayName,
    avatarUrl,
    gallery: {
      galleryMode: channelGallery.galleryMode,
      slideshowImages: channelGallery.slideshowImages,
      videoBackgroundUrl: channelGallery.videoBackgroundUrl ?? null,
    },
    textLayer: channelTextLayer,
    visual: channelVisual,
  })

  return (
    <div className="studio-channel-editor">
      <div className="studio-channel-editor__layout">
        <div className="studio-channel-editor__preview-col">
          <ChannelLivePreview draft={draft} />
          <Link
            href={`/c/${channelSlug}`}
            className="ui-btn ui-btn--secondary ui-btn--sm studio-channel-editor__preview-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open full channel page →
          </Link>
        </div>

        <div className="studio-channel-editor__controls-col">
          <ChannelEditorSection
            id="channel-gallery"
            title="Gallery & backdrop"
            description={
              <>
                Photos and optional video behind your channel player. WebGL styles are inspired by{' '}
                <a href={CHANNEL_GALLERY_SOURCE_URL} target="_blank" rel="noopener noreferrer">
                  freefrontend.com/three-js
                </a>
                .
              </>
            }
          >
            <ChannelGalleryPanel
              initial={channelGallery}
              bare
              onDraftChange={(gallery) => setDraft((d) => ({ ...d, gallery }))}
            />
          </ChannelEditorSection>

          <ChannelEditorSection
            id="channel-text"
            title="Text overlay"
            description={
              <>
                A stylized headline on your channel page. Effects from{' '}
                <a href={CHANNEL_TEXT_LAYER_SOURCE_URL} target="_blank" rel="noopener noreferrer">
                  freefrontend.com/css-text-effects
                </a>
                .
              </>
            }
          >
            <ChannelTextLayerPanel
              initial={channelTextLayer}
              bare
              onDraftChange={(textLayer) => setDraft((d) => ({ ...d, textLayer }))}
            />
          </ChannelEditorSection>

          <ChannelEditorSection
            id="channel-visual"
            title="Visual style"
            description="Background visualizer, color palette, and slideshow transitions."
          >
            <ChannelVisualPresetPanel
              channelSlug={channelSlug}
              initial={channelVisual}
              bare
              onDraftChange={(visual) => setDraft((d) => ({ ...d, visual }))}
            />
          </ChannelEditorSection>
        </div>
      </div>
    </div>
  )
}
