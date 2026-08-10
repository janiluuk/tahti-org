// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState, type ReactNode } from 'react'
import { HelpSpotlight, type HelpSpotlightStep } from '@tahti/ui'

type Tab = 'recent' | 'upcoming'
type StepId = 'player' | Tab

const HELP_STEPS: HelpSpotlightStep[] = [
  {
    id: 'player',
    label: 'Now playing',
    description:
      'The live Tahti Radio stream — whoever’s booked for this slot, or the 24/7 curated rotation when nobody is. The visualizer reacts to the audio, and the ♥ loves whatever’s currently playing.',
  },
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

/** Tahti Radio's player + schedule tab bar, wrapped in one help walkthrough —
 * "Now playing" spotlights the fixed player section (no tab to switch to);
 * "Recently played" and "Upcoming" switch the real tab underneath as the
 * walkthrough steps through them. */
export function RadioTabs({
  player,
  recent,
  upcoming,
}: {
  player: ReactNode
  recent: ReactNode
  upcoming: ReactNode
}) {
  const [active, setActive] = useState<Tab>('recent')
  const playerRef = useRef<HTMLDivElement | null>(null)
  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({ recent: null, upcoming: null })

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'recent', label: 'Recently played' },
    { id: 'upcoming', label: 'Upcoming' },
  ]

  return (
    <>
      <HelpSpotlight
        steps={HELP_STEPS}
        activeId={active}
        onNavigate={(id) => {
          if (id === 'recent' || id === 'upcoming') setActive(id)
        }}
        getTargetEl={(step) => {
          const id = step.id as StepId
          return id === 'player' ? playerRef.current : panelRefs.current[id]
        }}
      />
      <div ref={playerRef}>{player}</div>
      <div className="ch-radio-tabbed prof-tabs">
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
    </>
  )
}
