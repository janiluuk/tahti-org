// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { resolveChannelUrl } from '@/lib/app-url'
import ChannelTextLayerPanel from '../../channel-text-layer-panel'
import { ChannelEditorSection } from '../_channel-editor-section'
import { ChannelLivePreview, type ChannelPreviewDraft } from '../_channel-live-preview'
import { CHANNEL_TEXT_LAYER_SOURCE_URL } from '@tahti/shared'
import type { ChannelEditorFetchResult } from '../_channel-editor-data'

export type ChannelTextEditorData = ChannelEditorFetchResult & {
  channelSlug: string
  displayName: string
}

/** Text overlay — split off /dashboard/channel per literal-reference-method.md Rule B
 * (it doesn't appear in 08-channel-designer.html). */
export function ChannelTextSections({
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
}: ChannelTextEditorData) {
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
        </div>
      </div>
    </div>
  )
}
