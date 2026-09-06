// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cn } from '../lib/cn'

const LABEL = 'Tahti ry member'
const TITLE = 'Supports Tahti ry, the nonprofit that runs this platform'

/** Compact public-profile mark for association members — not a paid-tier / Pro badge. */
export function MemberBadge({ className }: { className?: string }) {
  return (
    <span className={cn('member-badge', className)} title={TITLE} aria-label={LABEL}>
      {LABEL}
    </span>
  )
}
