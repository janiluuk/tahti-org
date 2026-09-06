// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState, type ReactNode } from 'react'

type Tab = 'upcoming' | 'history'

/** Tahti Radio's player + schedule tab bar. */
export function RadioTabs({
  player,
  upcoming,
  history,
}: {
  player: ReactNode
  upcoming: ReactNode
  history: ReactNode
}) {
  const [active, setActive] = useState<Tab>('upcoming')
  const panelRefs = useRef<Record<Tab, HTMLDivElement | null>>({ upcoming: null, history: null })

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'upcoming', label: "What's next" },
    { id: 'history', label: 'History' },
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
          hidden={active !== 'upcoming'}
          ref={(el) => {
            panelRefs.current.upcoming = el
          }}
        >
          {upcoming}
        </div>
        <div
          className="prof-tabs__panel"
          hidden={active !== 'history'}
          ref={(el) => {
            panelRefs.current.history = el
          }}
        >
          {history}
        </div>
      </div>
    </>
  )
}
