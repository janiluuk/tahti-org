// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState, type ReactNode } from 'react'
import { HelpSpotlight, type HelpSpotlightStep } from '@tahti/ui'

type Tab = 'live' | 'archive' | 'releases' | 'feed' | 'bio'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'archive', label: 'Archive' },
  { id: 'releases', label: 'Releases' },
  { id: 'feed', label: 'Feed' },
  { id: 'bio', label: 'Bio' },
]

const HELP_STEPS: HelpSpotlightStep[] = [
  {
    id: 'live',
    label: 'Live',
    description:
      'What’s playing right now, if the artist is streaming — the visualizer, now-playing info, and chat all live here.',
  },
  {
    id: 'archive',
    label: 'Archive',
    description:
      'Past broadcasts and DJ sets the artist has kept around to listen back to, plus any external listen embeds.',
  },
  {
    id: 'releases',
    label: 'Releases',
    description: 'Every release the artist has published on Tahti — albums, EPs, and singles.',
  },
  {
    id: 'feed',
    label: 'Feed',
    description:
      'Posts and updates from the artist, newest first — news, behind-the-scenes updates, and announcements.',
  },
  {
    id: 'bio',
    label: 'Bio',
    description: 'Who the artist is — their bio, links, and other ways to find them.',
  },
]

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
  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({
    live: null,
    archive: null,
    releases: null,
    feed: null,
    bio: null,
  })

  return (
    <div className="prof-tabs">
      <HelpSpotlight
        steps={HELP_STEPS}
        activeId={active}
        onNavigate={(id) => setActive(id as Tab)}
        getTargetEl={(step) => panelRefs.current[step.id as Tab]}
      />
      <div className="prof-tabs__bar" role="tablist" aria-label="Channel sections">
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
        hidden={active !== 'live'}
        ref={(el) => {
          panelRefs.current.live = el
        }}
      >
        {live}
      </div>
      <div
        className="prof-tabs__panel"
        hidden={active !== 'archive'}
        ref={(el) => {
          panelRefs.current.archive = el
        }}
      >
        {archive}
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
        hidden={active !== 'bio'}
        ref={(el) => {
          panelRefs.current.bio = el
        }}
      >
        {bio}
      </div>
    </div>
  )
}
