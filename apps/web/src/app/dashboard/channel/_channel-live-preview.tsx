// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { CSSProperties, KeyboardEvent } from 'react'
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
import type { DesignerSectionId } from './_designer-sections'
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
  username?: string
  avatarUrl: string | null
  countryCode: string | null
  joinDate?: string | null
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
  activeSection,
  onSectionSelect,
}: {
  draft: ChannelPreviewDraft
  mode?: 'full' | 'visual'
  /** The designer section currently open — its matching preview region gets a persistent highlight. */
  activeSection?: DesignerSectionId
  /** When set, clicking a highlightable region jumps to that designer section. */
  onSectionSelect?: (id: DesignerSectionId) => void
}) {
  const backdrop = resolveArchiveBackground(draft.gallery.videoBackgroundUrl)
  const bannerStyle = resolveHeaderBannerStyle(draft.visual)
  const visualSettings = resolveVisualPresetSettings(
    parseVisualSettingsMap(draft.visual.visualSettingsJson),
    draft.visual.visualPreset,
  )
  const showMedia = mode === 'full'

  function regionProps(id: DesignerSectionId, label: string) {
    if (!onSectionSelect) return {}
    const active = activeSection === id
    return {
      className: `studio-channel-preview__region${active ? ' studio-channel-preview__region--active' : ''}`,
      role: 'button' as const,
      tabIndex: 0,
      onClick: () => onSectionSelect(id),
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSectionSelect(id)
        }
      },
      'aria-label': `Edit ${label}`,
    }
  }

  const headerRegion = regionProps('header', 'header & backdrop')
  const linksRegion = regionProps('links', 'links')
  const playerRegion = regionProps('player', 'player overlay text')
  const slideshowRegion = regionProps('slideshow', 'slideshow transitions')

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

          <div
            {...headerRegion}
            className={`ch-header-banner${headerRegion.className ? ` ${headerRegion.className}` : ''}`}
            style={bannerStyle}
          >
            <header className="ch-artist-header">
              <Row className="ui-row--gap-3 ch-artist-header-row">
                <AvatarTile
                  size="md"
                  name={draft.displayName}
                  src={draft.avatarUrl}
                  bordered
                  className="ch-artist-avatar"
                />
                <Heading level={1} className="ch-artist-name">
                  {draft.displayName}
                  {draft.pronouns && <span className="prof-pronouns">{draft.pronouns}</span>}
                </Heading>
              </Row>
              <Text size="sm" tone="muted" className="ch-artist-meta-row">
                {draft.username ? `@${draft.username}` : null}
                <span className="ch-artist-flag">
                  {draft.countryCode ? flagEmoji(draft.countryCode) : '🌍'}{' '}
                  {draft.countryCode ? countryName(draft.countryCode) : 'World citizen'}
                </span>
                {draft.joinDate && (
                  <span className="ch-artist-flag">
                    Member since{' '}
                    {new Date(draft.joinDate).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </Text>
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
                <div
                  {...linksRegion}
                  className={`prof-social-links${linksRegion.className ? ` ${linksRegion.className}` : ''}`}
                >
                  {draft.links.map((link) => (
                    <span key={link.label} className="prof-social-link">
                      <SocialLinkIcon label={link.label} url={link.url} /> {link.label}
                    </span>
                  ))}
                </div>
              )}
            </header>
          </div>

          {showMedia && (
            <div {...playerRegion} className={playerRegion.className}>
              <ChannelTextLayerView
                mode={draft.textLayer.textLayerMode}
                text={draft.textLayer.textLayerText}
                align={draft.textLayer.textLayerAlign}
              />
            </div>
          )}

          {showMedia && (
            <div {...slideshowRegion} className={slideshowRegion.className}>
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
          )}
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
