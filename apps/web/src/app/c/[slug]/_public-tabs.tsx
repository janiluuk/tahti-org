// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { HelpSpotlight, type HelpSpotlightStep } from '@tahti/ui'
import { channelTabForHash, type PublicChannelTab } from './channel-tab-routing'

type Tab = PublicChannelTab

const ALL_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'archive', label: 'Sounds' },
  { id: 'releases', label: 'Releases' },
  { id: 'feed', label: 'Feed' },
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
    label: 'Sounds',
    description:
      'Past broadcasts, DJ sets, and latest releases the artist has kept around to listen back to, plus any external listen embeds.',
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
]

/** Public tab bar for a channel page — Live is the player/now; Archive holds past
 * broadcasts, latest releases, and external listen embeds. Distinct from ChannelTabs
 * (owner Overview/Manage). Bio lives in the header now (always visible, not a tab). */
export function PublicChannelTabs({
  live,
  archive,
  releases,
  feed,
}: {
  /** Omit when the channel isn't currently live — the Live tab (and its
   * player) only appears while there's actually something to show, rather
   * than sitting in the bar permanently empty. Sounds is the landing tab
   * the rest of the time. */
  live?: ReactNode
  archive: ReactNode
  releases: ReactNode
  feed: ReactNode
}) {
  const hasLive = live != null
  const TABS = hasLive ? ALL_TABS : ALL_TABS.filter((tab) => tab.id !== 'live')
  const [active, setActive] = useState<Tab>(hasLive ? 'live' : 'archive')
  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({
    live: null,
    archive: null,
    releases: null,
    feed: null,
  })

  useEffect(() => {
    function activateDeepLink() {
      const targetTab = channelTabForHash(window.location.hash)
      if (!targetTab) return
      setActive(targetTab)
      requestAnimationFrame(() => {
        const target = document.getElementById(window.location.hash.slice(1))
        const details = target?.querySelector('details')
        if (details instanceof HTMLDetailsElement) details.open = true
        target?.scrollIntoView({ block: 'start' })
      })
    }

    activateDeepLink()
    window.addEventListener('hashchange', activateDeepLink)
    return () => window.removeEventListener('hashchange', activateDeepLink)
  }, [])

  return (
    <div className="prof-tabs">
      <HelpSpotlight
        steps={hasLive ? HELP_STEPS : HELP_STEPS.filter((step) => step.id !== 'live')}
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
      {hasLive && (
        <div
          className="prof-tabs__panel"
          hidden={active !== 'live'}
          ref={(el) => {
            panelRefs.current.live = el
          }}
        >
          {live}
        </div>
      )}
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
    </div>
  )
}
