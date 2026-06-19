// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import ChannelGalleryPanel from '../channel-gallery-panel'
import ChannelTextLayerPanel from '../channel-text-layer-panel'
import ChannelVisualPresetPanel from '../channel-visual-preset-panel'
import { ChannelEditorSection } from './_channel-editor-section'
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

/** Full-page channel appearance editor — gallery, text layer, visual style. */
export function ChannelEditorSections({
  channelSlug,
  channelGallery,
  channelTextLayer,
  channelVisual,
}: ChannelEditorData) {
  return (
    <div className="studio-channel-editor">
      <div className="studio-channel-editor__preview-bar">
        <p className="studio-channel-editor__preview-copy">
          Changes apply to your public channel at <strong>{channelSlug}.tahti.live</strong>. Save
          each section, then preview.
        </p>
        <Link
          href={`/c/${channelSlug}`}
          className="ui-btn ui-btn--secondary ui-btn--sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview channel →
        </Link>
      </div>

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
        <ChannelGalleryPanel initial={channelGallery} bare />
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
        <ChannelTextLayerPanel initial={channelTextLayer} bare />
      </ChannelEditorSection>

      <ChannelEditorSection
        id="channel-visual"
        title="Visual style"
        description="Background visualizer, color palette, and slideshow transitions."
      >
        <ChannelVisualPresetPanel channelSlug={channelSlug} initial={channelVisual} bare />
      </ChannelEditorSection>
    </div>
  )
}
