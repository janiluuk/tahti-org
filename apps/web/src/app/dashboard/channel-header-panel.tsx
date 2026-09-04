// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import type { ChannelGalleryMode, ChannelHeaderStyle } from '@tahti/shared'
import { ChannelHeaderStylePanel } from './channel-header-style-panel'
import ChannelGalleryPanel from './channel-gallery-panel'
import {
  VisibilitySettingsPanel,
  type VisibilitySettings,
} from './settings/visibility-settings-panel'

interface Props {
  tier: string
  initialHeaderStyle: ChannelHeaderStyle
  initialGallery: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  }
  initialVisibility: Pick<VisibilitySettings, 'showJoinDate' | 'showDailyListeners'>
  onHeaderStyleChange: (headerStyle: ChannelHeaderStyle) => void
  onGalleryChange: (gallery: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  }) => void
  onVisibilityChange: (
    visibility: Pick<VisibilitySettings, 'showJoinDate' | 'showDailyListeners'>,
  ) => void
}

/** "Header & backdrop" designer section — the top-of-page area artists see on their public
 * channel: banner style/media, plus what quick-facts (join date, listener count) show there.
 * Artist name/avatar/country/pronouns/tags stay on Settings → Artist info (one save path, no
 * duplicate editing surface); this section only links there. */
export function ChannelHeaderPanel({
  tier,
  initialHeaderStyle,
  initialGallery,
  initialVisibility,
  onHeaderStyleChange,
  onGalleryChange,
  onVisibilityChange,
}: Props) {
  return (
    <>
      <ChannelHeaderStylePanel
        tier={tier}
        hasVideoBackground={Boolean(initialGallery.videoBackgroundUrl)}
        initial={{ headerStyle: initialHeaderStyle }}
        onDraftChange={onHeaderStyleChange}
      />

      <ChannelGalleryPanel
        initial={initialGallery}
        bare
        hideSave
        showVideoBackground
        onDraftChange={onGalleryChange}
        onHeaderStyleChange={onHeaderStyleChange}
      />

      <div className="studio-field--block">
        <span className="studio-label">Quick facts</span>
        <VisibilitySettingsPanel
          initial={{
            ...initialVisibility,
            showFollowers: true,
            showFollowing: true,
            chatEnabled: true,
            showPageHero: true,
          }}
          bare
          hideSave
          fields={['showJoinDate', 'showDailyListeners']}
          onDraftChange={(settings) =>
            onVisibilityChange({
              showJoinDate: settings.showJoinDate,
              showDailyListeners: settings.showDailyListeners,
            })
          }
        />
      </div>

      <div className="studio-field--block">
        <Link
          href="/dashboard/settings/artist-info"
          className="ui-btn ui-btn--secondary ui-btn--sm"
        >
          Edit name, avatar & tags →
        </Link>
      </div>
    </>
  )
}
