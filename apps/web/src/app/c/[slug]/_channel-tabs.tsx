'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, type ReactNode } from 'react'

/** Wraps the channel page body in an Overview/Manage tab bar for the owner or
 * a board member — everyone else gets `children` (the normal public page)
 * completely unwrapped, no tab bar, no extra DOM. */
export function ChannelTabs({
  isOwnerOrAdmin,
  manage,
  children,
}: {
  isOwnerOrAdmin: boolean
  manage: ReactNode
  children: ReactNode
}) {
  const [tab, setTab] = useState<'overview' | 'manage'>('overview')

  if (!isOwnerOrAdmin) return <>{children}</>

  return (
    <>
      <div className="ch-owner-tabs" role="tablist" aria-label="Channel view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          className={`ch-owner-tabs__tab${tab === 'overview' ? ' ch-owner-tabs__tab--active' : ''}`}
          onClick={() => setTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'manage'}
          className={`ch-owner-tabs__tab${tab === 'manage' ? ' ch-owner-tabs__tab--active' : ''}`}
          onClick={() => setTab('manage')}
        >
          Manage
        </button>
      </div>
      <div style={{ display: tab === 'overview' ? 'contents' : 'none' }}>{children}</div>
      <div style={{ display: tab === 'manage' ? 'contents' : 'none' }}>{manage}</div>
    </>
  )
}
