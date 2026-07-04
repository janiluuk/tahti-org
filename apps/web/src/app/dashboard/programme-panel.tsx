// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import NextLink from 'next/link'
import { Panel } from '@tahti/ui'
import type { ProgrammeItemRow } from './programme-actions'

/** Compact rotation summary for the broadcast tab — full editing lives at /dashboard/schedule. */
export default function ProgrammePanel({
  initial,
}: {
  initial: { fallbackMode: 'shuffle' | 'ordered'; items: ProgrammeItemRow[] }
}) {
  const { fallbackMode, items } = initial

  return (
    <Panel
      title="Rotation"
      headerTight
      description={`${items.length} item${items.length === 1 ? '' : 's'} · plays ${fallbackMode === 'shuffle' ? 'shuffled' : 'in order'} when you're offline`}
    >
      {items.length === 0 ? (
        <p className="studio-text-muted-sm">
          No rotation set yet — add archive sets or release tracks to play automatically when you
          are offline.
        </p>
      ) : (
        <ul className="studio-list studio-mt-sm">
          {items.slice(0, 5).map((item) => (
            <li key={item.id} className="studio-item-row--list">
              <span className="studio-flex-1">{item.title}</span>
            </li>
          ))}
          {items.length > 5 && <li className="studio-text-muted-sm">+{items.length - 5} more</li>}
        </ul>
      )}
      <NextLink
        href="/dashboard/schedule"
        className="ui-btn ui-btn--sm ui-btn--secondary studio-mt-sm"
      >
        Edit rotation →
      </NextLink>
    </Panel>
  )
}
