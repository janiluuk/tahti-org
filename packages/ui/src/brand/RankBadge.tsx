// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cn } from '../lib/cn'

/** Red "#N" badge overlaid on a track's artwork when it currently places in a
 * top list. The artwork wrapper needs `position: relative` — this component
 * only supplies the absolutely-positioned badge itself. */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  return (
    <span className={cn('rank-badge', className)} aria-label={`#${rank} on the top list`}>
      #{rank}
    </span>
  )
}
