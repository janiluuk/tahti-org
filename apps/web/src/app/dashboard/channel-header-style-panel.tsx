// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import {
  CHANNEL_HEADER_STYLES,
  CHANNEL_HEADER_STYLE_LABELS,
  type ChannelHeaderStyle,
} from '@tahti/shared'

interface Props {
  /** Video loop header is a paid-tier feature. */
  tier: string
  /** Whether Channel.videoBackgroundUrl (Header & backdrop) is already configured. */
  hasVideoBackground: boolean
  initial: { headerStyle: ChannelHeaderStyle }
  onDraftChange?: (headerStyle: ChannelHeaderStyle) => void
}

/** Header banner style tile picker — split out of ChannelVisualPresetPanel so it can live in the
 * Header & backdrop designer section instead, next to the backdrop media it actually controls. */
export function ChannelHeaderStylePanel({
  tier,
  hasVideoBackground,
  initial,
  onDraftChange,
}: Props) {
  const [headerStyle, setHeaderStyle] = useState<ChannelHeaderStyle>(initial.headerStyle)
  const canUseVideoLoop = tier !== 'FREE'

  useEffect(() => {
    onDraftChange?.(headerStyle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerStyle])

  function selectHeaderStyle(style: ChannelHeaderStyle) {
    if (style === 'VIDEO_LOOP' && !canUseVideoLoop) return
    setHeaderStyle(style)
  }

  return (
    <div className="studio-field--block">
      <span className="studio-label">Header style</span>
      <div className="channel-header-style-tiles">
        {CHANNEL_HEADER_STYLES.map((style) => {
          const locked = style === 'VIDEO_LOOP' && !canUseVideoLoop
          return (
            <button
              key={style}
              type="button"
              disabled={locked}
              className={`channel-header-style-tile${headerStyle === style ? ' channel-header-style-tile--active' : ''}`}
              aria-pressed={headerStyle === style}
              onClick={() => selectHeaderStyle(style)}
            >
              {CHANNEL_HEADER_STYLE_LABELS[style]}
              {locked ? <span className="channel-header-style-tile__badge">paid</span> : null}
            </button>
          )
        })}
      </div>
      {headerStyle === 'VIDEO_LOOP' && !hasVideoBackground ? (
        <p className="studio-text-muted-sm studio-mt-sm">Add the video URL below.</p>
      ) : null}
    </div>
  )
}
