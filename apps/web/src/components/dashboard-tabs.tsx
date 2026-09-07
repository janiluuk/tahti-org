// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

export interface DashboardTab {
  id: string
  label: string
  content: ReactNode
}

/** Client-side tabs for splitting an overloaded dashboard page into focused
 * sections — uses the .studio-tabs CSS system (brand-studio.css:3985). Each
 * trigger button has a stable `#dashboard-tab-<id>` id, so the top-right
 * HelpTourButton/GuidedTour (tour-steps.ts) can target a specific tab
 * directly without this component needing its own help affordance. */
export function DashboardTabs({ tabs, ariaLabel }: { tabs: DashboardTab[]; ariaLabel: string }) {
  const [active, setActive] = useState(tabs[0]?.id)

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

  return (
    <div className="studio-tabs">
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
