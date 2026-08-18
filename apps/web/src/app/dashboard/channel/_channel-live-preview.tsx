// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { CSSProperties } from 'react'
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
import {
  BRAND_ACCENT_PRESETS,
  DEFAULT_COLOR_SCHEME,
  parseColorScheme,
  parseVisualSettingsMap,
  resolveVisualPresetSettings,
  type ChannelGalleryMode,
  type ChannelHeaderStyle,
  type ChannelTextLayerAlignment,
  type ChannelTextLayerMode,
  type SlideshowPreset,
  type VisualPreset,
} from '@tahti/shared'

export type ChannelPreviewDraft = {
  displayName: string
  avatarUrl: string | null
  countryCode: string | null
  pronouns: string | null
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
    visualSettingsJson: string | null
    headerStyle: ChannelHeaderStyle
    brandAccentPreset: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
  }
}

function resolveHeaderBannerStyle(
  visual: ChannelPreviewDraft['visual'],
): CSSProperties | undefined {
  if (visual.headerStyle === 'VIDEO_LOOP') return undefined // rendered via the backdrop below
  const preset = BRAND_ACCENT_PRESETS.find((p) => p.id === visual.brandAccentPreset)
  if (visual.headerStyle === 'SOLID') {
    const scheme = parseColorScheme(visual.colorSchemeJson)
    return { background: preset?.accent ?? scheme?.accent ?? DEFAULT_COLOR_SCHEME.accent }
  }
  return { background: (preset ?? BRAND_ACCENT_PRESETS[0])?.gradient }
}

/** Mirrors the top-of-page visual stack from the public channel page, fed by live draft state.
 *  `mode="visual"` (Design editor) shows only what that page publishes — header chrome +
 *  visualizer — not gallery/text-layer edits that live on other settings pages. */
export function ChannelLivePreview({
  draft,
  mode = 'full',
}: {
  draft: ChannelPreviewDraft
  mode?: 'full' | 'visual'
}) {
  const backdrop = resolveArchiveBackground(draft.gallery.videoBackgroundUrl)
  const bannerStyle = resolveHeaderBannerStyle(draft.visual)
  const visualSettings = resolveVisualPresetSettings(
    parseVisualSettingsMap(draft.visual.visualSettingsJson),
    draft.visual.visualPreset,
  )
  const showMedia = mode === 'full'

  return (
    <div data-tahti-ui="brand" data-channel-root className="brand-channel studio-channel-preview">
      <div className="ch-page-content studio-channel-preview__inner">
        <ChannelColorScheme colorSchemeJson={draft.visual.colorSchemeJson} />

        {draft.visual.visualPreset !== 'MINIMAL' && (
          <ChannelVisualizer
            preset={draft.visual.visualPreset}
            colorSchemeJson={draft.visual.colorSchemeJson}
            settings={visualSettings}
            className="ch-page-visualizer"
          />
        )}

        <div className="ch-page-foreground">
          {showMedia && draft.visual.headerStyle === 'VIDEO_LOOP' && backdrop.videoEmbedUrl && (
            <ArchiveVideoBackdrop embedUrl={backdrop.videoEmbedUrl} />
          )}
          {showMedia &&
            draft.visual.headerStyle === 'VIDEO_LOOP' &&
            backdrop.cssImageUrl &&
            !backdrop.videoEmbedUrl && (
              <div
                className="ch-channel-backdrop"
                style={{ ['--ch-backdrop-image' as string]: backdrop.cssImageUrl }}
              />
            )}

          {bannerStyle && <div className="ch-header-banner" style={bannerStyle} aria-hidden />}

          <header className="ch-artist-header">
            <Row className="ui-row--gap-3 ch-artist-header-row">
              <AvatarTile size="sm" name={draft.displayName} src={draft.avatarUrl} />
              <Heading level={2} className="ch-artist-name">
                {draft.displayName}
                {draft.pronouns && <span className="prof-pronouns">{draft.pronouns}</span>}
              </Heading>
            </Row>
            {draft.countryCode ? (
              <Text size="sm" tone="muted" className="ch-artist-flag">
                {flagEmoji(draft.countryCode)} {countryName(draft.countryCode)}
              </Text>
            ) : null}
            {showMedia && draft.bio && (
              <Text size="sm" className="ch-artist-bio">
                {draft.bio}
              </Text>
            )}
            {showMedia && draft.genres.length > 0 && (
              <div className="prof-tags">
                {draft.genres.map((tag) => (
                  <span key={tag} className="prof-tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {showMedia && draft.links.length > 0 && (
              <div className="prof-social-links">
                {draft.links.map((link) => (
                  <span key={link.label} className="prof-social-link">
                    <SocialLinkIcon label={link.label} url={link.url} /> {link.label}
                  </span>
                ))}
              </div>
            )}
          </header>

          {showMedia && (
            <ChannelTextLayerView
              mode={draft.textLayer.textLayerMode}
              text={draft.textLayer.textLayerText}
              align={draft.textLayer.textLayerAlign}
            />
          )}

          {showMedia &&
            (draft.gallery.galleryMode === 'STATIC_SLIDESHOW' &&
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
            ))}
        </div>
      </div>
      <Text size="sm" tone="muted" className="studio-channel-preview__caption">
        {mode === 'visual'
          ? 'Live preview — visual style for your channel'
          : 'Live preview — visualizer, header, backdrop, and gallery update as you edit'}
      </Text>
    </div>
  )
}
