// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import NextLink from 'next/link'
import { PageShell, SidebarNavIconSvg, Text } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { SetupChannelClient } from './_setup-channel-client'

export default async function SetupChannelPage() {
  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/setup-channel')
  if (user.channel) redirect('/dashboard/broadcast')

  const channelHost = `${user.username}.tahti.live`

  return (
    <PageShell size="md">
      <div className="setup-channel-page">
        <header className="setup-channel-page__header studio-page-header">
          <div>
            <div className="setup-channel-page__icon" aria-hidden>
              <SidebarNavIconSvg name="channel" />
            </div>
            <h1 className="setup-channel-page__title studio-page-title">
              Design your artist channel
            </h1>
            <Text tone="muted" size="sm">
              Your 24/7 home at <strong>{channelHost}</strong> — broadcast live (1 hour per week
              included), archive past sets, and share your work with listeners.
            </Text>
          </div>
          <div className="studio-page-header__actions">
            <NextLink href="/dashboard" className="ui-btn ui-btn--sm ui-btn--ghost">
              ← Dashboard
            </NextLink>
          </div>
        </header>

        <div className="setup-channel-page__card">
          <ul className="setup-channel-page__features">
            <li>
              <SidebarNavIconSvg name="distribution" />
              <span>Stream credentials and broadcast studio</span>
            </li>
            <li>
              <SidebarNavIconSvg name="upload" />
              <span>Archive uploads and smart links</span>
            </li>
            <li>
              <SidebarNavIconSvg name="newsletter" />
              <span>Fan subscriptions and newsletter</span>
            </li>
          </ul>
          <SetupChannelClient slug={user.username} />
        </div>
      </div>
    </PageShell>
  )
}
