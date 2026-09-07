// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState, type ReactNode } from 'react'

type Tab = 'recent' | 'upcoming'

/** Tahti Radio's player + schedule tab bar. */
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
  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({ recent: null, upcoming: null })

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'recent', label: 'Recently played' },
    { id: 'upcoming', label: 'Upcoming' },
  ]

  return (
    <>
      <div data-tour="radio-player">{player}</div>
      <div className="ch-radio-tabbed prof-tabs">
        <div className="prof-tabs__bar" role="tablist" aria-label="Radio schedule">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              data-tour={`radio-tab-${tab.id}`}
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
