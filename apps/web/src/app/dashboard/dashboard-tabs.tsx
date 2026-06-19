'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Panel, StudioTabs } from '@tahti/ui'

export type DashboardTabsProps = {
  hasChannel: boolean
  overview: ReactNode
  broadcast?: ReactNode
  catalog?: ReactNode
  audience?: ReactNode
  account: ReactNode
}

function ChannelRequiredPanel({ title, description }: { title: string; description: string }) {
  return (
    <Panel title={title} headerTight description={description}>
      <p className="studio-text-muted-sm">
        Set up your channel during signup to unlock archive, releases, broadcast, and audience
        tools.
      </p>
      <Link href="/signup/broadcast" className="ui-btn ui-btn--primary studio-mt-md">
        Set up channel
      </Link>
    </Panel>
  )
}

/** Client boundary for tabbed dashboard — compound StudioTabs must not cross RSC from @tahti/ui. */
export function DashboardTabs({
  hasChannel,
  overview,
  broadcast,
  catalog,
  audience,
  account,
}: DashboardTabsProps) {
  return (
    <StudioTabs defaultTab="overview" syncHash>
      <StudioTabs.List>
        <StudioTabs.Trigger value="overview">Overview</StudioTabs.Trigger>
        <StudioTabs.Trigger value="broadcast">Broadcast</StudioTabs.Trigger>
        <StudioTabs.Trigger value="catalog">Catalog</StudioTabs.Trigger>
        <StudioTabs.Trigger value="audience">Audience</StudioTabs.Trigger>
        <StudioTabs.Trigger value="account">Account</StudioTabs.Trigger>
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

      <StudioTabs.Panel value="catalog" id="studio-tabpanel-catalog">
        {hasChannel && catalog ? (
          catalog
        ) : (
          <ChannelRequiredPanel
            title="Archive & releases"
            description="Upload sets, manage releases, and smart links."
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

      <StudioTabs.Panel value="account" id="account">
        {account}
      </StudioTabs.Panel>
    </StudioTabs>
  )
}
