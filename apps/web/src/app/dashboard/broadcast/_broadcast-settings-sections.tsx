// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Suspense } from 'react'
import NextLink from 'next/link'
import { Panel, StudioCollapse } from '@tahti/ui'
import { LiveTracklistPanel } from '@/components/live-tracklist-panel'
import AnnouncementsPanel from '../announcements-panel'
import ModeratorsPanel from '../moderators-panel'
import type { ModeratorRow } from '../moderator-actions'
import ProgrammePanel from '../programme-panel'
import ChannelSchedulePanel from '../channel-schedule-panel'
import type { ProgrammeItemRow } from '../programme-actions'
import { MixcloudConnect } from '../mixcloud-connect'
import { TahtiRadioPanel } from '../tahti-radio-panel'

export type BroadcastSettingsSectionsProps = {
  channelSlug: string
  isLive: boolean
  announcements: Array<{ id: string; body: string; createdAt: string }>
  moderators: ModeratorRow[]
  channelProgramme: { fallbackMode: 'shuffle' | 'ordered'; items: ProgrammeItemRow[] }
  channelSchedule: { nextBroadcastAt: string | null; nextBroadcastNote: string | null }
  mixcloudStatus: { connected: boolean; configured: boolean }
  apiUrl: string
}

/** Schedule, distribution, and chat settings for the broadcast studio. */
export function BroadcastSettingsSections({
  channelSlug,
  isLive,
  announcements,
  moderators,
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

      <StudioCollapse title="Schedule & programme" hint="next show & running order" defaultOpen>
        <ProgrammePanel initial={channelProgramme} />
        <ChannelSchedulePanel
          initialAt={channelSchedule.nextBroadcastAt}
          initialNote={channelSchedule.nextBroadcastNote}
          isLive={isLive}
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

/** Compact link card pointing to the full channel design page. */
export function ChannelDesignLinkPanel() {
  return (
    <Panel
      title="Channel design"
      headerTight
      description="Gallery, text overlay, colors, and visual style for your public channel page."
      className="studio-channel-design-link"
    >
      <NextLink href="/dashboard/channel" className="ui-btn ui-btn--primary">
        Open channel editor →
      </NextLink>
    </Panel>
  )
}
