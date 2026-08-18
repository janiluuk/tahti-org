// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import NextLink from 'next/link'
import { SidebarNavIconSvg } from '@tahti/ui'
import { resolveChannelUrl } from '@/lib/app-url'
import { ShareEmbedButton } from './share-embed-button'
import { DesignNavLink } from './_design-nav-link'

type StudioHeaderActionsProps = {
  hasChannel?: boolean
  isLive?: boolean
  channelSlug?: string
  channelDisplayName?: string
  showBack?: boolean
  backHref?: string
  backLabel?: string
  showChannelActions?: boolean
}

export function ChannelManagementActions({
  channelSlug,
  channelDisplayName,
}: {
  channelSlug: string
  channelDisplayName?: string
}) {
  return (
    <>
      <DesignNavLink />
      <NextLink href={resolveChannelUrl(channelSlug)} className="ui-btn ui-btn--sm ui-btn--ghost">
        <SidebarNavIconSvg name="channel" />
        View channel
      </NextLink>
      <ShareEmbedButton channelSlug={channelSlug} displayName={channelDisplayName ?? channelSlug} />
    </>
  )
}

/** Standard dashboard subpage header actions — upload, go live, optional back link. */
export function StudioHeaderActions({
  hasChannel = true,
  isLive = false,
  channelSlug,
  channelDisplayName,
  showBack = false,
  backHref = '/dashboard',
  backLabel = 'Dashboard',
  showChannelActions = true,
}: StudioHeaderActionsProps) {
  return (
    <div className="studio-header-actions">
      {showBack ? (
        <NextLink href={backHref} className="ui-btn ui-btn--sm ui-btn--ghost">
          ← {backLabel}
        </NextLink>
      ) : null}
      <NextLink href="/dashboard/upload" className="ui-btn ui-btn--sm ui-btn--secondary">
        <SidebarNavIconSvg name="upload" />
        Upload
      </NextLink>
      {hasChannel ? (
        <>
          <NextLink
            href="/dashboard/broadcast"
            className={`db-go-live-btn db-go-live-btn--compact${isLive ? ' db-go-live-btn--live' : ''}`}
          >
            <span
              className={isLive ? 'signal-dot' : 'db-offline-dot'}
              aria-hidden
              style={{ width: 6, height: 6 }}
            />
            {isLive ? 'On air' : 'Go live'}
          </NextLink>
          {channelSlug && showChannelActions ? (
            <ChannelManagementActions
              channelSlug={channelSlug}
              channelDisplayName={channelDisplayName}
            />
          ) : null}
        </>
      ) : (
        <NextLink
          href="/dashboard/setup-channel"
          className="db-go-live-btn db-go-live-btn--channel"
        >
          <SidebarNavIconSvg name="channel" />
          Design channel
        </NextLink>
      )}
    </div>
  )
}
