// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'

export interface StickyLiveBarProps {
  artistName: string
  channelHref: string
  listeners?: number | null
  isFlac?: boolean
}

/** PLAT-032: fixed-bottom banner when channel is live. */
export function StickyLiveBar({
  artistName,
  channelHref,
  listeners,
  isFlac = false,
}: StickyLiveBarProps) {
  return (
    <div className="ch-sticky-live-bar" role="status">
      <span className="ch-sticky-live-dot" aria-hidden />
      <span className="ch-sticky-live-text">
        <strong>{artistName}</strong> is live
        {listeners != null && (
          <span className="ch-sticky-live-listeners"> · {listeners} listening</span>
        )}
      </span>
      {isFlac && <span className="ch-sticky-flac-badge">FLAC</span>}
      <Link href={channelHref} className="ch-sticky-live-open">
        Open →
      </Link>
    </div>
  )
}
