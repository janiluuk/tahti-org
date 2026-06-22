'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Panel, SidebarNavIconSvg, StudioTabs } from '@tahti/ui'

export type DashboardTabsProps = {
  hasChannel: boolean
  overview: ReactNode
  broadcast?: ReactNode
  audience?: ReactNode
}

function ChannelRequiredPanel({ title, description }: { title: string; description: string }) {
  return (
    <Panel title={title} headerTight description={description}>
      <p className="studio-text-muted-sm">
        Create your artist channel to use archive, releases, broadcast, and audience tools. Every
        member can design a channel at username.tahti.live — broadcast up to 1 hour per week
        included.
      </p>
      <Link href="/dashboard/setup-channel" className="ui-btn ui-btn--primary studio-mt-md">
        <SidebarNavIconSvg name="channel" />
        Design your artist channel
      </Link>
    </Panel>
  )
}

/** Client boundary for tabbed dashboard — compound StudioTabs must not cross RSC from @tahti/ui. */
export function DashboardTabs({ hasChannel, overview, broadcast, audience }: DashboardTabsProps) {
  return (
    <StudioTabs defaultTab="overview" syncHash>
      <StudioTabs.List>
        <StudioTabs.Trigger value="overview">Overview</StudioTabs.Trigger>
        <StudioTabs.Trigger value="broadcast">Broadcast</StudioTabs.Trigger>
        <StudioTabs.Trigger value="audience">Audience</StudioTabs.Trigger>
      </StudioTabs.List>

      <StudioTabs.Panel value="overview" id="overview">
        {overview}
      </StudioTabs.Panel>

      <StudioTabs.Panel value="broadcast" id="studio-tabpanel-broadcast">
        {hasChannel && broadcast ? (
          broadcast
        ) : (
          <ChannelRequiredPanel
            title="Broadcast"
            description="Stream keys, channel appearance, and distribution."
          />
        )}
      </StudioTabs.Panel>

      <StudioTabs.Panel value="audience" id="studio-tabpanel-audience">
        {hasChannel && audience ? (
          audience
        ) : (
          <ChannelRequiredPanel title="Audience" description="Fan subscriptions and newsletter." />
        )}
      </StudioTabs.Panel>
    </StudioTabs>
  )
}
