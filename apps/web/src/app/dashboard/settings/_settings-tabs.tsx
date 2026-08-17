// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type ReactNode } from 'react'

export interface SettingsTab {
  id: string
  label: string
  content: ReactNode
}

/** Client-side tabs for splitting an overloaded settings page into focused
 * sections — uses the existing (previously unused) .studio-tabs CSS system. */
export function SettingsTabs({ tabs, ariaLabel }: { tabs: SettingsTab[]; ariaLabel: string }) {
  const [active, setActive] = useState(tabs[0]?.id)

  return (
    <div className="studio-tabs">
      <div className="studio-tabs__list" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`studio-tabs__trigger${active === tab.id ? ' studio-tabs__trigger--active' : ''}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map(
        (tab) =>
          active === tab.id && (
            <div key={tab.id} className="studio-tabs__panel" role="tabpanel">
              {tab.content}
            </div>
          ),
      )}
    </div>
  )
}
