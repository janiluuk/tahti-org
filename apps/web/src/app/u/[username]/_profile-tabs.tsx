// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type ReactNode } from 'react'
import { ProfileTabSwitchProvider } from './_profile-tab-context'

export type ProfileTabId =
  'music' | 'releases' | 'djsets' | 'playlists' | 'collections' | 'tracks' | 'gallery'

export type ProfileTabSection = {
  id: ProfileTabId
  label: string
  description: string
  content: ReactNode
}

/** Tabbed profile content — each content type (Releases, DJ Sets, Playlists,
 * Collections, Tracks, ...) gets its own tab instead of being stacked inside
 * one "Releases" tab. Pass only the sections that actually have content;
 * empty ones are simply omitted from the bar rather than shown blank. */
export function ProfileTabs({ sections }: { sections: ProfileTabSection[] }) {
  const [active, setActiveState] = useState<ProfileTabId | undefined>(sections[0]?.id)

  function setActive(tab: ProfileTabId) {
    setActiveState(tab)
  }

  if (sections.length === 0) return null

  return (
    <div className="prof-tabs">
      <ProfileTabSwitchProvider value={setActive}>
        <div className="prof-tabs__bar" role="tablist" aria-label="Profile sections">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active === s.id}
              data-tour={`profile-tab-${s.id}`}
              className={`prof-tabs__tab${active === s.id ? ' prof-tabs__tab--active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {sections.map((s) => (
          <div key={s.id} className="prof-tabs__panel" hidden={active !== s.id}>
            {s.content}
          </div>
        ))}
      </ProfileTabSwitchProvider>
    </div>
  )
}
