// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type ReactNode } from 'react'

type Tab = 'recent' | 'upcoming'

/** Small tab bar under the Tahti Radio player, switching between what already
 * played (RecentlyPlayed) and what's coming next (UpcomingShows — booked
 * artist slots plus the curated rotation queue). */
export function RadioTabs({ recent, upcoming }: { recent: ReactNode; upcoming: ReactNode }) {
  const [active, setActive] = useState<Tab>('recent')

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'recent', label: 'Recently played' },
    { id: 'upcoming', label: 'Upcoming' },
  ]

  return (
    <div className="prof-tabs">
      <div className="prof-tabs__bar" role="tablist" aria-label="Radio schedule">
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
      <div className="prof-tabs__panel" hidden={active !== 'recent'}>
        {recent}
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'upcoming'}>
        {upcoming}
      </div>
    </div>
  )
}
