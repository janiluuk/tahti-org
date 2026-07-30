// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState, type ReactNode } from 'react'
import { HelpSpotlight, type HelpSpotlightStep } from '@tahti/ui'

type Tab = 'recent' | 'upcoming'

const HELP_STEPS: HelpSpotlightStep[] = [
  {
    id: 'recent',
    label: 'Recently played',
    description:
      'The tracks Tahti Radio has played most recently, in order — missed a track? It’s here.',
  },
  {
    id: 'upcoming',
    label: 'Upcoming',
    description:
      'Booked artist slots coming up on the live schedule, plus what the 24/7 rotation queue will play next when nobody’s booked.',
  },
]

/** Small tab bar under the Tahti Radio player, switching between what already
 * played (RecentlyPlayed) and what's coming next (UpcomingShows — booked
 * artist slots plus the curated rotation queue). */
export function RadioTabs({ recent, upcoming }: { recent: ReactNode; upcoming: ReactNode }) {
  const [active, setActive] = useState<Tab>('recent')
  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({ recent: null, upcoming: null })

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'recent', label: 'Recently played' },
    { id: 'upcoming', label: 'Upcoming' },
  ]

  return (
    <div className="ch-radio-tabbed prof-tabs">
      <HelpSpotlight
        steps={HELP_STEPS}
        activeId={active}
        onNavigate={(id) => setActive(id as Tab)}
        targetEl={panelRefs.current[active]}
      />
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
      <div
        className="prof-tabs__panel"
        hidden={active !== 'recent'}
        ref={(el) => {
          panelRefs.current.recent = el
        }}
      >
        {recent}
      </div>
      <div
        className="prof-tabs__panel"
        hidden={active !== 'upcoming'}
        ref={(el) => {
          panelRefs.current.upcoming = el
        }}
      >
        {upcoming}
      </div>
    </div>
  )
}
