// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type ReactNode } from 'react'

export function ProfileTabs({ overview, feed }: { overview: ReactNode; feed: ReactNode }) {
  const [active, setActive] = useState<'overview' | 'feed'>('overview')

  return (
    <div className="prof-tabs">
      <div className="prof-tabs__bar" role="tablist" aria-label="Profile sections">
        <button
          type="button"
          role="tab"
          aria-selected={active === 'overview'}
          className={`prof-tabs__tab${active === 'overview' ? ' prof-tabs__tab--active' : ''}`}
          onClick={() => setActive('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'feed'}
          className={`prof-tabs__tab${active === 'feed' ? ' prof-tabs__tab--active' : ''}`}
          onClick={() => setActive('feed')}
        >
          Feed
        </button>
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'overview'}>
        {overview}
      </div>
      <div className="prof-tabs__panel" hidden={active !== 'feed'}>
        {feed}
      </div>
    </div>
  )
}
