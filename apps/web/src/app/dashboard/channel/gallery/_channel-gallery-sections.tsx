// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resolveChannelUrl } from '@/lib/app-url'
import ChannelGalleryPanel from '../../channel-gallery-panel'
import ChannelSlideshowPanel from '../../channel-slideshow-panel'
import { ChannelEditorSection } from '../_channel-editor-section'
import { ChannelLivePreview, type ChannelPreviewDraft } from '../_channel-live-preview'
import { CHANNEL_GALLERY_SOURCE_URL } from '@tahti/shared'
import type { ChannelEditorFetchResult } from '../_channel-editor-data'

export type ChannelGalleryEditorData = ChannelEditorFetchResult & {
  channelSlug: string
  displayName: string
}

/** Gallery & backdrop + its slideshow transition — split off /dashboard/channel per
 * literal-reference-method.md Rule B (neither appears in 08-channel-designer.html). */
export function ChannelGallerySections({
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
}: ChannelGalleryEditorData) {
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
        <div className="studio-channel-editor__preview-col" data-hero>
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
            id="channel-slideshow"
            title="Slideshow transition"
            description="Applies when your channel gallery cycles through images."
          >
            <ChannelSlideshowPanel
              initial={channelVisual}
              bare
              onDraftChange={(slideshow) =>
                setDraft((d) => ({ ...d, visual: { ...d.visual, ...slideshow } }))
              }
            />
          </ChannelEditorSection>
        </div>
      </div>
    </div>
  )
}
