// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useRef, useState, type ReactNode } from 'react'
import { HelpSpotlight, type HelpSpotlightStep } from '@tahti/ui'
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
  const panelRefs = useRef<Partial<Record<ProfileTabId, HTMLDivElement | null>>>({})

  function setActive(tab: ProfileTabId) {
    setActiveState(tab)
  }

  const helpSteps: HelpSpotlightStep[] = sections.map((s) => ({
    id: s.id,
    label: s.label,
    description: s.description,
  }))

  if (sections.length === 0) return null

  return (
    <div className="prof-tabs">
      <ProfileTabSwitchProvider value={setActive}>
        <HelpSpotlight
          steps={helpSteps}
          activeId={active}
          onNavigate={(id) => setActive(id as ProfileTabId)}
          getTargetEl={(step) => panelRefs.current[step.id as ProfileTabId] ?? null}
        />
        <div className="prof-tabs__bar" role="tablist" aria-label="Profile sections">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active === s.id}
              className={`prof-tabs__tab${active === s.id ? ' prof-tabs__tab--active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {sections.map((s) => (
          <div
            key={s.id}
            className="prof-tabs__panel"
            hidden={active !== s.id}
            ref={(el) => {
              panelRefs.current[s.id] = el
            }}
          >
            {s.content}
          </div>
        ))}
      </ProfileTabSwitchProvider>
    </div>
  )
}
