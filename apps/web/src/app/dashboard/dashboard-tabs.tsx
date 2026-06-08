'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { StudioTabs } from '@tahti/ui'

export type DashboardTabsProps = {
  hasChannel: boolean
  hashAliases: Record<string, string>
  overview: ReactNode
  broadcast?: ReactNode
  catalog?: ReactNode
  audience?: ReactNode
  account: ReactNode
}

/** Client boundary for tabbed dashboard — compound StudioTabs must not cross RSC from @tahti/ui. */
export function DashboardTabs({
  hasChannel,
  hashAliases,
  overview,
  broadcast,
  catalog,
  audience,
  account,
}: DashboardTabsProps) {
  return (
    <StudioTabs defaultTab="overview" syncHash hashAliases={hashAliases}>
      <StudioTabs.List>
        <StudioTabs.Trigger value="overview">Overview</StudioTabs.Trigger>
        {hasChannel && <StudioTabs.Trigger value="broadcast">Broadcast</StudioTabs.Trigger>}
        {hasChannel && <StudioTabs.Trigger value="catalog">Catalog</StudioTabs.Trigger>}
        {hasChannel && <StudioTabs.Trigger value="audience">Audience</StudioTabs.Trigger>}
        <StudioTabs.Trigger value="account">Account</StudioTabs.Trigger>
      </StudioTabs.List>

      <StudioTabs.Panel value="overview">{overview}</StudioTabs.Panel>

      {hasChannel && broadcast ? (
        <StudioTabs.Panel value="broadcast">{broadcast}</StudioTabs.Panel>
      ) : null}

      {hasChannel && catalog ? (
        <StudioTabs.Panel value="catalog">{catalog}</StudioTabs.Panel>
      ) : null}

      {hasChannel && audience ? (
        <StudioTabs.Panel value="audience">{audience}</StudioTabs.Panel>
      ) : null}

      <StudioTabs.Panel value="account">{account}</StudioTabs.Panel>
    </StudioTabs>
  )
}
