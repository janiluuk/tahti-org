// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, type ReactNode } from 'react'
import { StudioSidebar } from './StudioSidebar'
import { StudioTopNav } from './StudioTopNav'
import { StudioMobileNav } from './StudioMobileNav'
import { StudioLayoutContext } from './useAutoCollapseSidebar'
import type { NotificationBellItem } from './NotificationBell'
import type { MessagesBellConversation } from './MessagesBell'
import type { UpcomingShowInfo } from './UpcomingShowNotice'

type StudioShellProps = {
  children: ReactNode
  displayName?: string
  isLive?: boolean
  /** True only for a real broadcast (Channel.goneLiveAt set) — see the
   * comment on the same prop in StudioTopNavProps. */
  isReallyLive?: boolean
  goneLiveAt?: string | null
  nextBroadcastAt?: string | null
  nextUpcomingShow?: UpcomingShowInfo | null
  isBoard?: boolean
  hasChannel?: boolean
  channelUrl?: string
  fetchNotifications?: () => Promise<{
    notifications: NotificationBellItem[]
    unreadCount: number
  }>
  markNotificationsRead?: () => Promise<void>
  fetchConversations?: () => Promise<MessagesBellConversation[]>
  onGoLiveClick?: () => void
  logoutAction?: (formData: FormData) => void | Promise<void>
}

/** Production v8 dashboard layout (studio surface). Playground preview: DashboardShell. */
export function StudioShell({
  children,
  displayName,
  isLive,
  isReallyLive,
  goneLiveAt,
  nextBroadcastAt,
  nextUpcomingShow,
  isBoard,
  hasChannel = true,
  channelUrl,
  fetchNotifications,
  markNotificationsRead,
  fetchConversations,
  onGoLiveClick,
  logoutAction,
}: StudioShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div data-tahti-ui="studio" className="tahti-studio">
      <StudioTopNav
        displayName={displayName}
        isLive={isLive}
        isReallyLive={isReallyLive}
        goneLiveAt={goneLiveAt}
        nextBroadcastAt={nextBroadcastAt}
        nextUpcomingShow={nextUpcomingShow}
        isBoard={isBoard}
        hasChannel={hasChannel}
        channelUrl={channelUrl}
        fetchNotifications={fetchNotifications}
        markNotificationsRead={markNotificationsRead}
        fetchConversations={fetchConversations}
        onGoLiveClick={onGoLiveClick}
        logoutAction={logoutAction}
      />
      <StudioLayoutContext.Provider value={{ sidebarCollapsed, setSidebarCollapsed }}>
        <div
          className={`db-layout shell-app${sidebarCollapsed ? ' db-layout--sidebar-collapsed' : ''}`}
        >
          <StudioSidebar isBoard={isBoard} hasChannel={hasChannel} />
          <main className="db-main shell-app__content">{children}</main>
        </div>
      </StudioLayoutContext.Provider>
      <StudioMobileNav hasChannel={hasChannel} isBoard={isBoard} />
    </div>
  )
}
