// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { HelpSpotlight, type HelpSpotlightStep } from '@tahti/ui'

type Tab = 'stage' | 'feed' | 'tracks'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'stage', label: 'Bio' },
  { id: 'feed', label: 'Feed' },
  { id: 'tracks', label: 'Releases' },
]

const HELP_STEPS: HelpSpotlightStep[] = [
  {
    id: 'stage',
    label: 'Bio',
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

function isTab(value: string | null): value is Tab {
  return value === 'stage' || value === 'feed' || value === 'tracks'
}

export function ProfileTabs({
  stage,
  feed,
  tracks,
}: {
  stage: ReactNode
  feed: ReactNode
  tracks: ReactNode
}) {
  const pathname = usePathname()
  const storageKey = `tahti:profile-tab:${pathname}`
  // Kept in sessionStorage (read on mount, not from a URL param) so switching
  // tabs stays a free client-side toggle — this page is dynamic (session
  // cookie-gated), so encoding the tab in the URL would force a real server
  // round-trip per click. sessionStorage still survives the fresh mount that
  // happens when the browser back button returns here.
  const [active, setActiveState] = useState<Tab>('stage')

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey)
    if (isTab(saved)) setActiveState(saved)
    // Only ever read once, right after this pathname's instance mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  function setActive(tab: Tab) {
    setActiveState(tab)
    sessionStorage.setItem(storageKey, tab)
  }

  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({
    stage: null,
    feed: null,
    tracks: null,
  })

  return (
    <div className="prof-tabs">
      <HelpSpotlight
        steps={HELP_STEPS}
        activeId={active}
        onNavigate={(id) => setActive(id as Tab)}
        targetEl={panelRefs.current[active]}
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
    </div>
  )
}
