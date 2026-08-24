// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-studio.css'
import '@tahti/ui/src/styles/shells.css'
import { getDashboardUser } from '@/lib/dashboard-session'
import { resolveChannelUrl } from '@/lib/app-url'
import { logout } from '@/app/auth/actions'
import {
  fetchMyNotifications,
  fetchMyStickyNotifications,
  markAllNotificationsRead,
} from './notification-actions'
import { fetchConversations } from './messages/actions'
import { fetchNextUpcomingShow } from './_upcoming-show-actions'
import { StudioShellClient } from './_studio-shell-client'
import { StickyNotificationBanner } from './_sticky-notification-banner'

/** Dashboard uses StudioShell from @tahti/ui (import brand-studio.css once here). */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getDashboardUser()
  const displayName = user?.displayName
  // "Online" (top-nav icon color) is broader than "really live": the 24/7
  // rotation flips Channel.state to LIVE too (see channel-fallback-reconciler),
  // so state alone can't tell a real broadcast from the archive just looping.
  // goneLiveAt is only ever set by the actual go-live route.
  const isOnline = Boolean(user?.channel) && user?.channel?.state !== 'OFFLINE'
  const isReallyLive = Boolean(user?.channel?.goneLiveAt)
  const isBoard = user?.isBoard ?? false
  const hasChannel = Boolean(user?.channel)
  const channelUrl = user?.channel ? resolveChannelUrl(user.channel.slug) : undefined
  const stickyNotifications = user ? await fetchMyStickyNotifications() : []
  // Both possible sources (a Tahti Radio slot, an episode on your own
  // schedule) require a channel to have booked anything in the first place.
  const nextUpcomingShow = hasChannel ? await fetchNextUpcomingShow() : null

  return (
    <StudioShellClient
      displayName={displayName}
      isLive={isOnline}
      isReallyLive={isReallyLive}
      goneLiveAt={user?.channel?.goneLiveAt ?? null}
      nextBroadcastAt={user?.channel?.nextBroadcastAt ?? null}
      nextUpcomingShow={nextUpcomingShow}
      isBoard={isBoard}
      hasChannel={hasChannel}
      channelUrl={channelUrl}
      channelSlug={user?.channel?.slug}
      fetchNotifications={fetchMyNotifications}
      markNotificationsRead={markAllNotificationsRead}
      fetchConversations={fetchConversations}
      logoutAction={logout}
    >
      <StickyNotificationBanner initial={stickyNotifications} />
      {children}
    </StudioShellClient>
  )
}
