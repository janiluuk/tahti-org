// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'

export interface PinnedAnnouncementProps {
  children: React.ReactNode
  className?: string
}

/** Amber-bordered pinned callout for channel chat and dashboard notices. */
export function PinnedAnnouncement({ children, className }: PinnedAnnouncementProps) {
  return (
    <div className={cn('pinned-announcement', className)} role="note">
      <div className="pinned-announcement__label" aria-hidden>
        📌 PINNED
      </div>
      <div className="pinned-announcement__body">{children}</div>
    </div>
  )
}
