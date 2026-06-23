// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resolveChannelUrl } from '@/lib/app-url'
import ChannelGalleryPanel from '../channel-gallery-panel'
import ChannelTextLayerPanel from '../channel-text-layer-panel'
import ChannelVisualPresetPanel from '../channel-visual-preset-panel'
import ChannelIdentityPanel from '../channel-identity-panel'
import ChannelLinksPanel, { type ChannelLink } from '../channel-links-panel'
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
  countryCode: string | null
  pronouns: string | null
  bio: string
  genres: string[]
  links: ChannelLink[]
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

/** Full-page channel customization studio — live preview beside identity, visual, and link controls. */
export function ChannelEditorSections({
  channelSlug,
  displayName,
  avatarUrl,
  countryCode,
  pronouns,
  bio,
  genres,
  links,
  channelGallery,
  channelTextLayer,
  channelVisual,
}: ChannelEditorData) {
  const [draft, setDraft] = useState<ChannelPreviewDraft>({
    displayName,
    avatarUrl,
    countryCode,
    pronouns,
    bio,
    genres,
    links,
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
            href={resolveChannelUrl(channelSlug)}
            className="ui-btn ui-btn--secondary ui-btn--sm studio-channel-editor__preview-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open full channel page →
          </Link>
        </div>

        <div className="studio-channel-editor__controls-col">
          <ChannelEditorSection
            id="channel-identity"
            title="Identity"
            description="Who you are — shown at the top of your channel page."
          >
            <ChannelIdentityPanel
              initial={{ displayName, avatarUrl, countryCode, pronouns, bio, genres }}
              onDraftChange={(identity) => setDraft((d) => ({ ...d, ...identity }))}
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
            id="channel-links"
            title="Links"
            description="Where else listeners can find you — shown on your channel page."
          >
            <ChannelLinksPanel
              initial={links}
              onDraftChange={(newLinks) => setDraft((d) => ({ ...d, links: newLinks }))}
            />
          </ChannelEditorSection>
        </div>
      </div>
    </div>
  )
}
