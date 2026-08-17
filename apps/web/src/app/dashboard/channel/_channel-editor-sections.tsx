// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ButtonIcon, Button } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import { updateChannelVisual } from '../channel-visual-actions'
import { updateChannelGallery } from '../channel-gallery-actions'
import ChannelVisualPresetPanel from '../channel-visual-preset-panel'
import ChannelGalleryPanel from '../channel-gallery-panel'
import ChannelSlideshowPanel from '../channel-slideshow-panel'
import { PressKitBuilder } from '../settings/presskit/_press-kit-builder'
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
  PressKitImageItem,
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
    visualSettingsJson: string | null
    headerStyle: ChannelHeaderStyle
    brandAccentPreset: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
  }
  pressKit: {
    images: PressKitImageItem[]
    galleryPublic: boolean
    username: string
    apiUrl: string
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
  pressKit,
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
      const galleryRes = await updateChannelGallery({
        galleryMode: draft.gallery.galleryMode,
        slideshowImages: draft.gallery.slideshowImages,
        videoBackgroundUrl: draft.gallery.videoBackgroundUrl,
      })
      if (galleryRes.error) {
        setError(galleryRes.error)
        return
      }
      const visualRes = await updateChannelVisual({
        visualPreset: draft.visual.visualPreset,
        colorScheme: draft.visual.colorSchemeJson ? JSON.parse(draft.visual.colorSchemeJson) : null,
        visualSettings: draft.visual.visualSettingsJson
          ? JSON.parse(draft.visual.visualSettingsJson)
          : null,
        headerStyle: draft.visual.headerStyle,
        brandAccentPreset: draft.visual.brandAccentPreset,
        slideshowPreset: draft.visual.slideshowPreset,
        slideshowIntervalSeconds: draft.visual.slideshowIntervalSeconds,
        slideshowTransitionMs: draft.visual.slideshowTransitionMs,
        slideshowAutoplay: draft.visual.slideshowAutoplay,
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

          <ChannelEditorSection
            id="channel-media"
            title="Background media"
            description="Choose a gallery style and provide only the media used by the current design."
          >
            <ChannelGalleryPanel
              initial={channelGallery}
              bare
              hideSave
              showVideoBackground={draft.visual.headerStyle === 'VIDEO_LOOP'}
              onDraftChange={(gallery) => setDraft((current) => ({ ...current, gallery }))}
            />
          </ChannelEditorSection>

          {draft.gallery.galleryMode !== 'NONE' ? (
            <ChannelEditorSection
              id="channel-slideshow"
              title="Slideshow transitions"
              description="Controls how gallery images move and change on your channel."
            >
              <ChannelSlideshowPanel
                initial={channelVisual}
                bare
                hideSave
                onDraftChange={(slideshow) =>
                  setDraft((current) => ({
                    ...current,
                    visual: { ...current.visual, ...slideshow },
                  }))
                }
              />
            </ChannelEditorSection>
          ) : null}
        </div>
      </div>

      <section className="studio-designer-presskit" id="presskit">
        <div className="studio-designer-section-heading">
          <span className="studio-kicker">Promotional media</span>
          <h2>Press kit</h2>
          <p>Upload, arrange, and publish promoter-ready images without leaving the designer.</p>
        </div>
        <PressKitBuilder
          initialImages={pressKit.images}
          initialGalleryPublic={pressKit.galleryPublic}
          username={pressKit.username}
          displayName={displayName}
          bio={bio}
          apiUrl={pressKit.apiUrl}
        />
      </section>
    </div>
  )
}
