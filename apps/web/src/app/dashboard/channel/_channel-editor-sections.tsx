// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ButtonIcon, Button } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import { updateChannelVisual } from '../channel-visual-actions'
import ChannelVisualPresetPanel from '../channel-visual-preset-panel'
import type { ChannelLink } from '../channel-links-panel'
import { ChannelEditorSection } from './_channel-editor-section'
import { ChannelLivePreview, type ChannelPreviewDraft } from './_channel-live-preview'
import type {
  ChannelGalleryMode,
  ChannelHeaderStyle,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  SlideshowPreset,
  VisualPreset,
} from '@tahti/shared'

export type ChannelEditorData = {
  channelSlug: string
  tier: string
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
    headerStyle: ChannelHeaderStyle
    brandAccentPreset: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
  }
}

/** Full-page channel customization studio — live preview beside identity, visual, and link controls. */
export function ChannelEditorSections({
  channelSlug,
  tier,
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
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function publish() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const visualRes = await updateChannelVisual({
        visualPreset: draft.visual.visualPreset,
        colorScheme: draft.visual.colorSchemeJson ? JSON.parse(draft.visual.colorSchemeJson) : null,
        headerStyle: draft.visual.headerStyle,
        brandAccentPreset: draft.visual.brandAccentPreset,
      })
      if (visualRes.error) {
        setError(visualRes.error)
        return
      }
      setMessage('Channel published.')
    })
  }

  return (
    <div className="studio-channel-editor">
      <div className="studio-channel-editor__publish-bar">
        <div className="studio-channel-editor__publish-bar-notice">
          {error && <p className="studio-notice studio-notice--error">{error}</p>}
          {message && <p className="studio-notice studio-notice--success">{message}</p>}
        </div>
        <Button onClick={publish} disabled={isPending} variant="primary">
          <ButtonIcon name="send" />
          {isPending ? 'Publishing…' : 'Publish changes'}
        </Button>
      </div>
      <div className="studio-channel-editor__layout">
        <div className="studio-channel-editor__preview-col" data-hero>
          <ChannelLivePreview draft={draft} />
          <div className="studio-row studio-gap-md studio-mt-sm">
            <Link
              href={resolveChannelUrl(channelSlug)}
              className="ui-btn ui-btn--secondary ui-btn--sm studio-channel-editor__preview-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open full channel page →
            </Link>
            <Link
              href="/dashboard/settings/artist-info"
              className="ui-btn ui-btn--ghost ui-btn--sm"
            >
              Edit name, bio & links →
            </Link>
          </div>
        </div>

        <div className="studio-channel-editor__controls-col">
          <ChannelEditorSection id="channel-visual" title="Visual">
            <ChannelVisualPresetPanel
              channelSlug={channelSlug}
              tier={tier}
              hasVideoBackground={Boolean(channelGallery.videoBackgroundUrl)}
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
