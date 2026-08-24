'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { StreamManagerPanel } from '@/app/dashboard/_stream-manager-panel'
import { ChannelControlsPanel } from '@/app/dashboard/channel-controls-panel'

type SubTab = 'listen' | 'manage'

/** Owner-only "Stream manager" sub-tab inside the channel page's Live section —
 * distinct from the top-nav go-live icon's modal (same underlying panels, just
 * reachable from the channel page itself too). Gated to the true owner only
 * (not board admins): StreamManagerPanel's "End stream" and
 * ChannelControlsPanel's rotation controls both act on the *session's own*
 * channel, not the slug in the URL — safe for the owner viewing their own
 * page, but would silently control the wrong channel for a board member
 * viewing someone else's. */
export function LiveTabContent({
  isOwner,
  slug,
  displayName,
  isReallyLive,
  rotationTrackCount,
  listenContent,
}: {
  isOwner: boolean
  slug: string
  displayName: string
  isReallyLive: boolean
  rotationTrackCount: number
  /** The existing public player/tracklist content — unchanged for visitors. */
  listenContent: ReactNode
}) {
  const [tab, setTab] = useState<SubTab>(isReallyLive ? 'listen' : 'manage')

  if (!isOwner) return <>{listenContent}</>

  return (
    <div className="ch-live-owner">
      <div
        className="prof-tabs__bar ch-live-owner__subtabs"
        role="tablist"
        aria-label="Live section"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'listen'}
          className={`prof-tabs__tab${tab === 'listen' ? ' prof-tabs__tab--active' : ''}`}
          onClick={() => setTab('listen')}
        >
          Listen
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'manage'}
          className={`prof-tabs__tab${tab === 'manage' ? ' prof-tabs__tab--active' : ''}`}
          onClick={() => setTab('manage')}
        >
          Stream manager
        </button>
      </div>

      {tab === 'listen' ? (
        (listenContent ?? (
          <p className="studio-text-muted-sm ch-live-owner__empty">
            You&apos;re not live right now — switch to Stream manager to check in or start your 24/7
            rotation.
          </p>
        ))
      ) : isReallyLive ? (
        <StreamManagerPanel slug={slug} displayName={displayName} />
      ) : rotationTrackCount > 0 ? (
        <ChannelControlsPanel slug={slug} />
      ) : (
        <div className="ch-live-owner__empty-state" aria-disabled="true">
          <div className="ch-live-owner__empty-controls">
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" disabled>
              ⏮
            </button>
            <button type="button" className="ui-btn ui-btn--primary ui-btn--sm" disabled>
              Start channel
            </button>
            <button type="button" className="ui-btn ui-btn--secondary ui-btn--sm" disabled>
              ⏭
            </button>
          </div>
          <p className="studio-text-muted-sm">
            Nothing is live, and your 24/7 rotation has no tracks yet.
          </p>
          <Link
            href="/dashboard/channel/playlist"
            className="ui-btn ui-btn--ghost ui-btn--sm"
            aria-label="Set up your 24/7 playlist"
            title="Set up your 24/7 playlist"
          >
            ⚙ 24/7 playlist settings
          </Link>
        </div>
      )}
    </div>
  )
}
