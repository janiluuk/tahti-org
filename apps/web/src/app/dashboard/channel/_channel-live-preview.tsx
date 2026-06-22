// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { AvatarTile, Heading, Row, Text } from '@tahti/ui'
import { SocialLinkIcon } from '@/components/social-link-icon'
import { countryName } from '@/lib/country-options'
import { flagEmoji } from '@/lib/flag-emoji'
import { ChannelColorScheme } from '@/components/visuals/channel-color-scheme'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { ChannelSlideshow } from '@/components/visuals/channel-slideshow'
import { ChannelGalleryView } from '@/components/gallery'
import { ChannelTextLayerView } from '@/components/text-layer'
import {
  ArchiveVideoBackdrop,
  resolveArchiveBackground,
} from '@/app/c/[slug]/archive-item-backdrop'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  SlideshowPreset,
  VisualPreset,
} from '@tahti/shared'

export type ChannelPreviewDraft = {
  displayName: string
  avatarUrl: string | null
  countryCode: string | null
  bio: string
  genres: string[]
  links: Array<{ label: string; url: string }>
  gallery: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl: string | null
  }
  textLayer: {
    textLayerMode: ChannelTextLayerMode
    textLayerText: string
    textLayerAlign: ChannelTextLayerAlignment
  }
  visual: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
  }
}

/** Mirrors the top-of-page visual stack from the public channel page, fed by live draft state. */
export function ChannelLivePreview({ draft }: { draft: ChannelPreviewDraft }) {
  const backdrop = resolveArchiveBackground(draft.gallery.videoBackgroundUrl)

  return (
    <div data-tahti-ui="brand" data-channel-root className="brand-channel studio-channel-preview">
      <div className="ch-page-content studio-channel-preview__inner">
        <ChannelColorScheme colorSchemeJson={draft.visual.colorSchemeJson} />

        {draft.visual.visualPreset !== 'MINIMAL' && (
          <ChannelVisualizer
            preset={draft.visual.visualPreset}
            colorSchemeJson={draft.visual.colorSchemeJson}
            className="ch-page-visualizer"
          />
        )}

        <div className="ch-page-foreground">
          {backdrop.videoEmbedUrl && <ArchiveVideoBackdrop embedUrl={backdrop.videoEmbedUrl} />}
          {backdrop.cssImageUrl && !backdrop.videoEmbedUrl && (
            <div
              className="ch-channel-backdrop"
              style={{ ['--ch-backdrop-image' as string]: backdrop.cssImageUrl }}
            />
          )}

          <header className="ch-artist-header">
            <Row className="ui-row--gap-3 ch-artist-header-row">
              <AvatarTile size="sm" name={draft.displayName} src={draft.avatarUrl} />
              <Heading level={2} className="ch-artist-name">
                {draft.displayName}
              </Heading>
            </Row>
            <Text size="sm" tone="muted" className="ch-artist-flag">
              {draft.countryCode ? flagEmoji(draft.countryCode) : '🌍'}{' '}
              {draft.countryCode ? countryName(draft.countryCode) : 'World citizen'}
            </Text>
            {draft.bio && (
              <Text size="sm" className="ch-artist-bio">
                {draft.bio}
              </Text>
            )}
            {draft.genres.length > 0 && (
              <div className="prof-tags">
                {draft.genres.map((tag) => (
                  <span key={tag} className="prof-tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {draft.links.length > 0 && (
              <div className="prof-social-links">
                {draft.links.map((link) => (
                  <span key={link.label} className="prof-social-link">
                    <SocialLinkIcon label={link.label} url={link.url} /> {link.label}
                  </span>
                ))}
              </div>
            )}
          </header>

          <ChannelTextLayerView
            mode={draft.textLayer.textLayerMode}
            text={draft.textLayer.textLayerText}
            align={draft.textLayer.textLayerAlign}
          />

          {draft.gallery.galleryMode === 'STATIC_SLIDESHOW' &&
          draft.gallery.slideshowImages.length > 0 ? (
            <ChannelSlideshow
              images={draft.gallery.slideshowImages}
              preset={draft.visual.slideshowPreset}
              intervalSeconds={draft.visual.slideshowIntervalSeconds}
              transitionMs={draft.visual.slideshowTransitionMs}
              autoplay={draft.visual.slideshowAutoplay}
            />
          ) : (
            <ChannelGalleryView
              mode={draft.gallery.galleryMode}
              images={draft.gallery.slideshowImages}
            />
          )}
        </div>
      </div>
      <Text size="sm" tone="muted" className="studio-channel-preview__caption">
        Live preview — what listeners see at the top of your channel page
      </Text>
    </div>
  )
}
