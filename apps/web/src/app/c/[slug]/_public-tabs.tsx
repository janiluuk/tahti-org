// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'live' | 'archive' | 'releases' | 'feed' | 'bio'

/** Public tab bar for a channel page — Live is the player/now; Archive holds past
 * broadcasts and external listen embeds. Distinct from ChannelTabs (owner Overview/Manage). */
export function PublicChannelTabs({
  live,
  archive,
  releases,
  feed,
  bio,
}: {
  live: ReactNode
  archive: ReactNode
  releases: ReactNode
  feed: ReactNode
  bio: ReactNode
}) {
  const [active, setActive] = useState<Tab>('live')

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'live', label: 'Live' },
    { id: 'archive', label: 'Archive' },
    { id: 'releases', label: 'Releases' },
    { id: 'feed', label: 'Feed' },
    { id: 'bio', label: 'Bio' },
  ]

  return (
    <div className="prof-tabs">
      <div className="prof-tabs__bar" role="tablist" aria-label="Channel sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`prof-tabs__tab${active === tab.id ? ' prof-tabs__tab--active' : ''}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'live'}>
        {live}
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'archive'}>
        {archive}
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'releases'}>
        {releases}
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'feed'}>
        {feed}
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'bio'}>
        {bio}
      </div>
    </div>
  )
}
