// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState, type ReactNode } from 'react'
import { HelpSpotlight, type HelpSpotlightStep } from '@tahti/ui'
import { ProfileTabSwitchProvider } from './_profile-tab-context'

type Tab = 'stage' | 'feed' | 'tracks'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'stage', label: 'Home' },
  { id: 'feed', label: 'Feed' },
  { id: 'tracks', label: 'Releases' },
]

const HELP_STEPS: HelpSpotlightStep[] = [
  {
    id: 'stage',
    label: 'Home',
    description:
      'The artist’s bio, latest releases, upcoming shows and events, pinned highlights, press kit, band members, and links to other platforms — everything that introduces who they are, in one scroll.',
  },
  {
    id: 'feed',
    label: 'Feed',
    description:
      'Posts and updates from the artist, newest first — news, behind-the-scenes updates, and announcements about new music or shows.',
  },
  {
    id: 'tracks',
    label: 'Releases',
    description:
      'Every release, DJ mix, playlist, and individual track the artist has published on Tahti — this is where you go to actually listen.',
  },
]

export function ProfileTabs({
  stage,
  feed,
  tracks,
}: {
  stage: ReactNode
  feed: ReactNode
  tracks: ReactNode
}) {
  const [active, setActiveState] = useState<Tab>('tracks')

  function setActive(tab: Tab) {
    setActiveState(tab)
  }

  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({
    stage: null,
    feed: null,
    tracks: null,
  })

  return (
    <div className="prof-tabs">
      <ProfileTabSwitchProvider value={setActive}>
        <HelpSpotlight
          steps={HELP_STEPS}
          activeId={active}
          onNavigate={(id) => setActive(id as Tab)}
          getTargetEl={(step) => panelRefs.current[step.id as Tab]}
        />
        <div className="prof-tabs__bar" role="tablist" aria-label="Profile sections">
          {TABS.map((tab) => (
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
          hidden={active !== 'stage'}
          ref={(el) => {
            panelRefs.current.stage = el
          }}
        >
          {stage}
        </div>
        <div
          className="prof-tabs__panel"
          hidden={active !== 'feed'}
          ref={(el) => {
            panelRefs.current.feed = el
          }}
        >
          {feed}
        </div>
        <div
          className="prof-tabs__panel"
          hidden={active !== 'tracks'}
          ref={(el) => {
            panelRefs.current.tracks = el
          }}
        >
          {tracks}
        </div>
      </ProfileTabSwitchProvider>
    </div>
  )
}
