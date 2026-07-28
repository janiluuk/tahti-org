// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'live' | 'releases' | 'feed' | 'bio'

/** Public tab bar for a channel page — every channel (including Tahti Radio's
 * own /c/tahti-radio) gets the same Live/Releases/Feed/Bio structure as an
 * artist's /u/[username] profile. Distinct from ChannelTabs, which is the
 * owner-only Overview/Manage switch this wraps inside of. */
export function PublicChannelTabs({
  live,
  releases,
  feed,
  bio,
}: {
  live: ReactNode
  releases: ReactNode
  feed: ReactNode
  bio: ReactNode
}) {
  const [active, setActive] = useState<Tab>('live')

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'live', label: 'Live' },
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
