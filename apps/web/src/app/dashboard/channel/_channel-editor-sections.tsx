// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, ButtonIcon, navigateDashboardHash, useAutoCollapseSidebar } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import { updateChannelVisual } from '../channel-visual-actions'
import { updateChannelGallery } from '../channel-gallery-actions'
import { updateChannelProfile } from '../channel-identity-actions'
import { updateChannelTextLayer } from '../channel-text-layer-actions'
import { StudioHeaderActions } from '../_studio-header-actions'
import ChannelVisualPresetPanel from '../channel-visual-preset-panel'
import { ChannelHeaderPanel } from '../channel-header-panel'
import ChannelSlideshowPanel from '../channel-slideshow-panel'
import ChannelLinksPanel from '../channel-links-panel'
import ChannelTextLayerPanel from '../channel-text-layer-panel'
import type { ChannelLink } from '../channel-links-panel'
import { DesignerSectionList } from './_designer-section-list'
import {
  DESIGNER_SECTIONS,
  designerSectionById,
  resolveDesignerSection,
  type DesignerSectionDefinition,
  type DesignerSectionId,
} from './_designer-sections'
import { ChannelLivePreview, type ChannelPreviewDraft } from './_channel-live-preview'
import type {
  ChannelGalleryMode,
  ChannelHeaderStyle,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  SlideshowPreset,
  VisualPreset,
} from '@tahti/shared'

function linksToSocialLinks(links: Array<{ label: string; url: string }>): Record<string, string> {
  const map: Record<string, string> = {}
  for (const { label, url } of links) {
    const key = label.trim()
    if (key && url.trim()) map[key] = url.trim()
  }
  return map
}

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
  streamingLinks: {
    youtube: string
    hearthisAt: string
    twitch: string
    soundcloud: string
    kick: string
  }
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
  isLive: boolean
  showJoinDate: boolean
  showDailyListeners: boolean
}

/** Full-page channel customization studio — one focused section at a time, live preview beside it. */
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
  streamingLinks,
  channelGallery,
  channelTextLayer,
  channelVisual,
  isLive,
  showJoinDate,
  showDailyListeners,
}: ChannelEditorData) {
  useAutoCollapseSidebar()
  const router = useRouter()

  const [draft, setDraft] = useState<ChannelPreviewDraft>({
    displayName,
    username: channelSlug,
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
  const [visibility, setVisibility] = useState({ showJoinDate, showDailyListeners })
  const [activeSection, setActiveSection] = useState<DesignerSectionId>(DESIGNER_SECTIONS[0]!.id)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    function sync() {
      setActiveSection(resolveDesignerSection(window.location.hash))
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  function selectSection(id: DesignerSectionId) {
    navigateDashboardHash(designerSectionById(id).hash)
  }

  async function saveSection(section: DesignerSectionDefinition): Promise<boolean> {
    if (section.saveKind === 'visual' || section.saveKind === 'header') {
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
        return false
      }
    }
    if (section.saveKind === 'header') {
      const galleryRes = await updateChannelGallery({
        galleryMode: draft.gallery.galleryMode,
        slideshowImages: draft.gallery.slideshowImages,
        videoBackgroundUrl: draft.gallery.videoBackgroundUrl,
      })
      if (galleryRes.error) {
        setError(galleryRes.error)
        return false
      }
      const profileRes = await updateChannelProfile({
        showJoinDate: visibility.showJoinDate,
        showDailyListeners: visibility.showDailyListeners,
      })
      if (profileRes.error) {
        setError(profileRes.error)
        return false
      }
    }
    if (section.saveKind === 'profile') {
      const profileRes = await updateChannelProfile({
        socialLinks: {
          genres: draft.genres.join(', '),
          youtube: streamingLinks.youtube.trim(),
          hearthisAt: streamingLinks.hearthisAt.trim(),
          twitch: streamingLinks.twitch.trim(),
          soundcloud: streamingLinks.soundcloud.trim(),
          kick: streamingLinks.kick.trim(),
          ...linksToSocialLinks(draft.links),
        },
      })
      if (profileRes.error) {
        setError(profileRes.error)
        return false
      }
    }
    if (section.saveKind === 'textLayer') {
      const textLayerRes = await updateChannelTextLayer({
        textLayerMode: draft.textLayer.textLayerMode,
        textLayerText: draft.textLayer.textLayerText.trim(),
        textLayerAlign: draft.textLayer.textLayerAlign,
      })
      if (textLayerRes.error) {
        setError(textLayerRes.error)
        return false
      }
    }
    return true
  }

  function handleSave() {
    const section = designerSectionById(activeSection)
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const ok = await saveSection(section)
      if (ok) setMessage('Saved.')
    })
  }

  function handleDone() {
    const section = designerSectionById(activeSection)
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const ok = await saveSection(section)
      if (ok) router.push('/dashboard')
    })
  }

  const activeDef = designerSectionById(activeSection)

  return (
    <div className="studio-channel-editor">
      <div className="studio-designer-topbar">
        <div className="studio-designer-topbar__title">
          <span className="studio-kicker">Now editing</span>
          <h1 className="studio-designer-topbar__heading">{activeDef.title}</h1>
        </div>
        <StudioHeaderActions
          hasChannel
          isLive={isLive}
          channelSlug={channelSlug}
          showBack
          backHref="/dashboard"
          backLabel="Dashboard"
          showChannelActions={false}
        />
      </div>

      <div className="studio-channel-editor__layout">
        <DesignerSectionList
          sections={DESIGNER_SECTIONS}
          activeId={activeSection}
          onSelect={selectSection}
        />

        <div className="studio-designer-active-panel">
          <div className="studio-designer-active-panel__body">
            {activeDef.description ? (
              <p className="studio-help studio-mb-sm">{activeDef.description}</p>
            ) : null}
            {error && <p className="studio-notice studio-notice--error">{error}</p>}
            {message && <p className="studio-notice studio-notice--success">{message}</p>}

            {activeSection === 'visual' && (
              <ChannelVisualPresetPanel
                channelSlug={channelSlug}
                tier={tier}
                hasVideoBackground={Boolean(draft.gallery.videoBackgroundUrl)}
                initial={channelVisual}
                bare
                hideHeaderStyle
                onDraftChange={(visual) =>
                  setDraft((d) => ({
                    ...d,
                    visual: { ...d.visual, ...visual, headerStyle: d.visual.headerStyle },
                  }))
                }
              />
            )}

            {activeSection === 'header' && (
              <ChannelHeaderPanel
                tier={tier}
                initialHeaderStyle={channelVisual.headerStyle}
                initialGallery={channelGallery}
                initialVisibility={visibility}
                onHeaderStyleChange={(headerStyle) =>
                  setDraft((d) => ({ ...d, visual: { ...d.visual, headerStyle } }))
                }
                onGalleryChange={(gallery) =>
                  setDraft((d) => ({
                    ...d,
                    gallery: { ...gallery, videoBackgroundUrl: gallery.videoBackgroundUrl ?? null },
                  }))
                }
                onVisibilityChange={setVisibility}
              />
            )}

            {activeSection === 'slideshow' &&
              (draft.gallery.galleryMode === 'NONE' ? (
                <p className="studio-help">
                  Enable a gallery mode in Header &amp; backdrop first to configure slideshow
                  transitions.
                </p>
              ) : (
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
              ))}

            {activeSection === 'links' && (
              <ChannelLinksPanel
                initial={links}
                onDraftChange={(nextLinks) =>
                  setDraft((current) => ({ ...current, links: nextLinks }))
                }
              />
            )}

            {activeSection === 'player' && (
              <ChannelTextLayerPanel
                initial={channelTextLayer}
                bare
                hideSave
                onDraftChange={(textLayer) => setDraft((current) => ({ ...current, textLayer }))}
              />
            )}
          </div>

          <div className="studio-designer-panel__footer">
            <div className="studio-designer-panel__footer-notice" />
            <div className="studio-designer-panel__footer-actions">
              <Button variant="secondary" onClick={handleDone} disabled={isPending}>
                <ButtonIcon name="check" />
                Done
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={isPending}>
                <ButtonIcon name="save" />
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>

        <div className="studio-channel-editor__preview-col" data-hero>
          <ChannelLivePreview draft={draft} activeSection={activeSection} onSectionSelect={selectSection} />
          <div className="studio-row studio-gap-md studio-mt-sm">
            <Link
              href={resolveChannelUrl(channelSlug)}
              className="ui-btn ui-btn--secondary ui-btn--sm studio-channel-editor__preview-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open full channel page →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
