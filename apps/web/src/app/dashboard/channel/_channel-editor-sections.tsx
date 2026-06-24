// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { resolveChannelUrl } from '@/lib/app-url'
import { updateChannelProfile } from '../channel-identity-actions'
import { updateChannelVisual } from '../channel-visual-actions'
import ChannelVisualPresetPanel from '../channel-visual-preset-panel'
import ChannelIdentityPanel from '../channel-identity-panel'
import ChannelLinksPanel, { type ChannelLink } from '../channel-links-panel'
import { ChannelEditorSection } from './_channel-editor-section'
import { ChannelLivePreview, type ChannelPreviewDraft } from './_channel-live-preview'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  SlideshowPreset,
  VisualPreset,
} from '@tahti/shared'

function linksToSocialLinks(links: ChannelLink[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const { label, url } of links) {
    const key = label.trim()
    if (key && url.trim()) map[key] = url.trim()
  }
  return map
}

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
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function publish() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const [profileRes, visualRes] = await Promise.all([
        updateChannelProfile({
          displayName: draft.displayName,
          bio: draft.bio,
          avatarUrl: draft.avatarUrl ?? undefined,
          countryCode: draft.countryCode,
          pronouns: draft.pronouns,
          socialLinks: {
            genres: draft.genres.join(', '),
            ...linksToSocialLinks(draft.links),
          },
        }),
        updateChannelVisual({
          visualPreset: draft.visual.visualPreset,
          colorScheme: draft.visual.colorSchemeJson
            ? JSON.parse(draft.visual.colorSchemeJson)
            : null,
        }),
      ])
      const err = profileRes.error ?? visualRes.error
      if (err) {
        setError(err)
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
        <button
          type="button"
          className="ui-btn ui-btn--primary ui-btn--lg"
          onClick={publish}
          disabled={isPending}
        >
          {isPending ? 'Publishing…' : 'Publish changes'}
        </button>
      </div>
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
            description="Background visualizer and color palette."
          >
            <ChannelVisualPresetPanel
              channelSlug={channelSlug}
              initial={channelVisual}
              bare
              onDraftChange={(visual) => setDraft((d) => ({ ...d, visual }))}
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
