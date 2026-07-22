// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'stage' | 'feed' | 'tracks'

export function ProfileTabs({
  stage,
  feed,
  tracks,
}: {
  stage: ReactNode
  feed: ReactNode
  tracks: ReactNode
}) {
  const [active, setActive] = useState<Tab>('stage')

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'stage', label: 'Stage' },
    { id: 'feed', label: 'Feed' },
    { id: 'tracks', label: 'Tracks' },
  ]

  return (
    <div className="prof-tabs">
      <div className="prof-tabs__bar" role="tablist" aria-label="Profile sections">
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
      <div className="prof-tabs__panel" hidden={active !== 'stage'}>
        {stage}
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'feed'}>
        {feed}
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'tracks'}>
        {tracks}
      </div>
    </div>
  )
}
