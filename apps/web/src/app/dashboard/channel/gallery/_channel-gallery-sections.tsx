// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CHANNEL_GALLERY_SOURCE_URL } from '@tahti/shared'
import { Button, ButtonIcon } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import ChannelGalleryPanel from '../../channel-gallery-panel'
import ChannelSlideshowPanel, { type ChannelSlideshowDraft } from '../../channel-slideshow-panel'
import { updateChannelGallery } from '../../channel-gallery-actions'
import { updateChannelVisual } from '../../channel-visual-actions'
import { ChannelEditorSection } from '../_channel-editor-section'
import { ChannelLivePreview, type ChannelPreviewDraft } from '../_channel-live-preview'
import type { ChannelEditorFetchResult } from '../_channel-editor-data'

export type ChannelGalleryEditorData = ChannelEditorFetchResult & {
  channelSlug: string
  displayName: string
}

/** Gallery & backdrop + slideshow transition — lives under Settings → Media & Presskit. */
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
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
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

  function publish() {
    setError(null)
    setMessage(null)
    const { gallery, visual } = draft
    if (gallery.galleryMode !== 'NONE' && gallery.slideshowImages.length === 0) {
      setError('Add at least one HTTPS image URL for the gallery.')
      return
    }
    startTransition(async () => {
      const galleryRes = await updateChannelGallery({
        galleryMode: gallery.galleryMode,
        slideshowImages: gallery.slideshowImages,
        videoBackgroundUrl: gallery.videoBackgroundUrl,
      })
      if (galleryRes.error) {
        setError(galleryRes.error)
        return
      }
      const slideshow: ChannelSlideshowDraft = {
        slideshowPreset: visual.slideshowPreset,
        slideshowIntervalSeconds: visual.slideshowIntervalSeconds,
        slideshowTransitionMs: visual.slideshowTransitionMs,
        slideshowAutoplay: visual.slideshowAutoplay,
      }
      const visualRes = await updateChannelVisual(slideshow)
      if (visualRes.error) {
        setError(visualRes.error)
        return
      }
      setMessage('Channel published.')
      router.refresh()
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
              hideSave
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
              hideSave
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
