// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Suspense } from 'react'
import NextLink from 'next/link'
import { Panel, StudioCollapse } from '@tahti/ui'
import { LiveTracklistPanel } from '@/components/live-tracklist-panel'
import AnnouncementsPanel from '../announcements-panel'
import ModeratorsPanel from '../moderators-panel'
import type { ModeratorRow } from '../moderator-actions'
import ChannelGalleryPanel from '../channel-gallery-panel'
import ChannelTextLayerPanel from '../channel-text-layer-panel'
import ChannelVisualPresetPanel from '../channel-visual-preset-panel'
import ProgrammePanel from '../programme-panel'
import ChannelSchedulePanel from '../channel-schedule-panel'
import type { ProgrammeItemRow } from '../programme-actions'
import { MixcloudConnect } from '../mixcloud-connect'
import { TahtiRadioPanel } from '../tahti-radio-panel'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  SlideshowPreset,
  VisualPreset,
} from '@tahti/shared'

export type BroadcastSettingsSectionsProps = {
  channelSlug: string
  isLive: boolean
  appearanceDefaultOpen?: boolean
  announcements: Array<{ id: string; body: string; createdAt: string }>
  moderators: ModeratorRow[]
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
  channelProgramme: { fallbackMode: 'shuffle' | 'ordered'; items: ProgrammeItemRow[] }
  channelSchedule: { nextBroadcastAt: string | null; nextBroadcastNote: string | null }
  mixcloudStatus: { connected: boolean; configured: boolean }
  apiUrl: string
}

/** Collapsible channel appearance, schedule, and distribution settings. */
export function BroadcastSettingsSections({
  channelSlug,
  isLive,
  appearanceDefaultOpen = false,
  announcements,
  moderators,
  channelGallery,
  channelTextLayer,
  channelVisual,
  channelProgramme,
  channelSchedule,
  mixcloudStatus,
  apiUrl,
}: BroadcastSettingsSectionsProps) {
  return (
    <section id="broadcast" className="studio-section-anchor broadcast-settings-sections">
      {isLive && (
        <Panel title="Live tracklist" headerTight>
          <LiveTracklistPanel slug={channelSlug} heading="Detected tracks" showPlaceholder />
        </Panel>
      )}

      <div id="channel-appearance" className="studio-section-anchor">
        <StudioCollapse
          title="Channel appearance"
          hint="gallery, text overlay & visual style"
          defaultOpen={appearanceDefaultOpen}
        >
          <ChannelGalleryPanel initial={channelGallery} />
          <ChannelTextLayerPanel initial={channelTextLayer} />
          <ChannelVisualPresetPanel channelSlug={channelSlug} initial={channelVisual} />
        </StudioCollapse>
      </div>

      <StudioCollapse title="Schedule & programme" hint="next show & running order">
        <ProgrammePanel initial={channelProgramme} />
        <ChannelSchedulePanel
          initialAt={channelSchedule.nextBroadcastAt}
          initialNote={channelSchedule.nextBroadcastNote}
        />
      </StudioCollapse>

      <Panel
        title="Multistream"
        headerTight
        description="Mirror your live broadcast to other platforms"
      >
        <p className="studio-text-muted-sm studio-mb-sm">
          Manage RTMP targets, status, and stream keys on a dedicated page.
        </p>
        <NextLink
          href="/dashboard/settings/multistream"
          className="ui-btn ui-btn--sm ui-btn--secondary"
        >
          Manage multistream targets →
        </NextLink>
      </Panel>

      <StudioCollapse title="Distribution & chat" hint="Mixcloud, Tahti Radio, announcements, mods">
        <Suspense fallback={null}>
          <MixcloudConnect
            initial={{
              connected: mixcloudStatus.connected,
              configured: mixcloudStatus.configured,
            }}
            apiUrl={apiUrl}
          />
        </Suspense>
        <TahtiRadioPanel />
        <AnnouncementsPanel initial={announcements} />
        <ModeratorsPanel initial={moderators} channelSlug={channelSlug} />
      </StudioCollapse>
    </section>
  )
}
