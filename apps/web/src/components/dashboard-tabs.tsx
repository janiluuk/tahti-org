// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { HelpSpotlight, type HelpSpotlightStep } from '@tahti/ui'

export interface DashboardTab {
  id: string
  label: string
  content: ReactNode
  /** Shown by the "?" help walkthrough when present. Tabs without one are
   * still tabs, just not part of the guided tour. */
  helpDescription?: string
}

/** Client-side tabs for splitting an overloaded dashboard page into focused
 * sections — uses the .studio-tabs CSS system (brand-studio.css:3985). Any
 * tab with a `helpDescription` is automatically included in a "?" help
 * walkthrough (same HelpSpotlight used on public profile/radio/channel
 * pages) — new pages get the tour for free by adding descriptions. */
export function DashboardTabs({ tabs, ariaLabel }: { tabs: DashboardTab[]; ariaLabel: string }) {
  const [active, setActive] = useState(tabs[0]?.id)
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const selectTab = useCallback(
    (tabId: string, updateHash = true) => {
      if (!tabs.some((tab) => tab.id === tabId)) return
      setActive(tabId)
      if (updateHash && typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#${tabId}`)
      }
    },
    [tabs],
  )

  useEffect(() => {
    function selectFromHash() {
      const tabId = window.location.hash.slice(1)
      if (tabId) selectTab(tabId, false)
    }
    selectFromHash()
    window.addEventListener('hashchange', selectFromHash)
    return () => window.removeEventListener('hashchange', selectFromHash)
  }, [selectTab])

  const helpSteps: HelpSpotlightStep[] = tabs
    .filter((t) => t.helpDescription)
    .map((t) => ({ id: t.id, label: t.label, description: t.helpDescription! }))

  return (
    <div className="studio-tabs">
      {helpSteps.length > 0 && (
        <HelpSpotlight
          steps={helpSteps}
          activeId={active}
          onNavigate={selectTab}
          getTargetEl={(step) => panelRefs.current[step.id] ?? null}
        />
      )}
      <div className="studio-tabs__list" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`dashboard-tab-${tab.id}`}
            aria-controls={`dashboard-tabpanel-${tab.id}`}
            aria-selected={active === tab.id}
            className={`studio-tabs__trigger${active === tab.id ? ' studio-tabs__trigger--active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map(
        (tab) =>
          active === tab.id && (
            <div
              key={tab.id}
              ref={(el) => {
                panelRefs.current[tab.id] = el
              }}
              className="studio-tabs__panel"
              role="tabpanel"
              id={`dashboard-tabpanel-${tab.id}`}
              aria-labelledby={`dashboard-tab-${tab.id}`}
            >
              {tab.content}
            </div>
          ),
      )}
    </div>
  )
}
