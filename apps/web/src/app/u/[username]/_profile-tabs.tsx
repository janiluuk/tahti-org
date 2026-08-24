// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState, type ReactNode } from 'react'
import { HelpSpotlight, type HelpSpotlightStep } from '@tahti/ui'
import { ProfileTabSwitchProvider } from './_profile-tab-context'

type Tab = 'music' | 'releases'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'music', label: 'Music' },
  { id: 'releases', label: 'Releases' },
]

const HELP_STEPS: HelpSpotlightStep[] = [
  {
    id: 'music',
    label: 'Music',
    description: 'Pinned highlights and the artist’s most recently published music.',
  },
  {
    id: 'releases',
    label: 'Releases',
    description:
      'Every release, DJ mix, playlist, and individual track the artist has published on Tahti — this is where you go to actually listen.',
  },
]

export function ProfileTabs({ music, releases }: { music: ReactNode; releases: ReactNode }) {
  const [active, setActiveState] = useState<Tab>('music')

  function setActive(tab: Tab) {
    setActiveState(tab)
  }

  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({
    music: null,
    releases: null,
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
          hidden={active !== 'music'}
          ref={(el) => {
            panelRefs.current.music = el
          }}
        >
          {music}
        </div>
        <div
          className="prof-tabs__panel"
          hidden={active !== 'releases'}
          ref={(el) => {
            panelRefs.current.releases = el
          }}
        >
          {releases}
        </div>
      </ProfileTabSwitchProvider>
    </div>
  )
}
